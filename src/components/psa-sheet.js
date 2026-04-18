import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'
import { lookupCert } from '../services/psa.js'

let _cardId          = null
let _psaGrade        = null
let _psaImage        = null
let _scrimWasVisible = false

function syncLookupBtn() {
  const co  = document.getElementById('reg_company')?.value
  const btn = document.getElementById('btnLookupPSA')
  if (btn) btn.style.display = co === 'PSA' ? '' : 'none'
}

export function openPSASheet(cardId) {
  _cardId   = cardId
  _psaGrade = null
  _psaImage = null
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return

  const co = card['Grading Company'] || 'PSA'

  const companyEl = document.getElementById('reg_company')
  if (companyEl) {
    companyEl.value    = ['PSA', 'BGS', 'SGC', 'CGC'].includes(co) ? co : 'PSA'
    companyEl.onchange = syncLookupBtn
  }

  document.getElementById('psa_cert').value = card.PSACert || ''
  document.getElementById('reg_pop').value  = card.PSAPop != null ? String(card.PSAPop) : ''

  const statusEl = document.getElementById('psaFetchStatus')
  statusEl.style.display = 'none'
  statusEl.textContent   = ''

  const titleEl = document.getElementById('registrySheetTitle')
  if (titleEl) titleEl.textContent = `${co} Registry`

  const saveBtn = document.getElementById('btnSavePSA')
  saveBtn.disabled    = false
  saveBtn.textContent = 'Save to Card'

  syncLookupBtn()

  const scrim = document.getElementById('globalScrim')
  _scrimWasVisible = !!(scrim && scrim.style.display === 'block')
  if (scrim) { scrim.style.zIndex = '1150'; scrim.style.display = 'block' }

  document.getElementById('psaSheet').classList.add('open')
}

export function closePSASheet() {
  const sheet = document.getElementById('psaSheet')
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.style.transform = 'translateY(100%)'
  setTimeout(() => { sheet.classList.remove('open'); sheet.style.transform = '' }, 340)

  const scrim = document.getElementById('globalScrim')
  if (scrim) {
    scrim.style.zIndex = '900'
    if (!_scrimWasVisible) scrim.style.display = 'none'
  }
}

export async function fetchAndPreviewPSA() {
  const certNum = document.getElementById('psa_cert').value.trim()
  if (!certNum) return

  const btn      = document.getElementById('btnLookupPSA')
  const statusEl = document.getElementById('psaFetchStatus')

  btn.disabled    = true
  btn.textContent = 'Looking up…'
  statusEl.style.color   = 'var(--md-on-surface-variant)'
  statusEl.textContent   = 'Fetching from PSA…'
  statusEl.style.display = 'block'

  try {
    const data = await lookupCert(certNum)
    _psaGrade = data.grade || null
    _psaImage = data.frontImage || null

    document.getElementById('psa_cert').value = data.cert || certNum
    document.getElementById('reg_pop').value  = data.pop != null ? String(data.pop) : ''

    const parts = [data.grade ? `Grade: ${data.grade}` : 'Lookup successful']
    if (_psaImage) parts.push('· image found')
    statusEl.textContent = parts.join(' ')
    statusEl.style.color = 'var(--md-on-surface-variant)'
  } catch (err) {
    statusEl.style.color = '#C62828'
    statusEl.textContent = err.message || 'Lookup failed'
  } finally {
    btn.disabled    = false
    btn.textContent = 'Look Up from PSA'
  }
}

export async function savePSAData() {
  if (!_cardId) return
  const btn = document.getElementById('btnSavePSA')

  const certVal    = document.getElementById('psa_cert').value.trim()
  const popVal     = document.getElementById('reg_pop').value.trim()
  const companyVal = document.getElementById('reg_company').value

  btn.disabled    = true
  btn.textContent = 'Saving…'

  try {
    const updates = {
      PSACert: certVal || null,
      PSAPop:  popVal ? Number(popVal) : null,
    }
    if (_psaGrade) updates.PSAGrade = _psaGrade
    if (_psaImage) updates['App Image'] = _psaImage

    const card = state.ALL_CARDS.find(c => c.id === _cardId)
    if (card && card['Grading Company'] !== companyVal) {
      updates['Grading Company'] = companyVal
    }

    await setDoc(doc(db, 'Cards', _cardId), updates, { merge: true })
    closePSASheet()
  } catch (e) {
    console.error('savePSAData error:', e)
  } finally {
    btn.disabled    = false
    btn.textContent = 'Save to Card'
  }
}
