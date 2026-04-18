import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'
import { lookupCert } from '../services/psa.js'

let _cardId = null
let _fetchedData = null
let _scrimWasVisible = false

export function openPSASheet(cardId) {
  _cardId = cardId
  _fetchedData = null
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return

  document.getElementById('psa_cert').value = card.PSACert || ''
  document.getElementById('psaFetchStatus').style.display = 'none'
  document.getElementById('psaFetchStatus').textContent   = ''
  document.getElementById('psaFetchResult').style.display = 'none'

  const saveBtn = document.getElementById('btnSavePSA')
  saveBtn.style.display = 'none'
  saveBtn.disabled      = false
  saveBtn.textContent   = 'Save to Card'

  const lookupBtn = document.getElementById('btnLookupPSA')
  lookupBtn.disabled    = false
  lookupBtn.textContent = 'Look Up'

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
  const resultEl = document.getElementById('psaFetchResult')

  btn.disabled = true
  btn.textContent = 'Looking up…'
  statusEl.style.color   = 'var(--md-on-surface-variant)'
  statusEl.textContent   = 'Fetching from PSA…'
  statusEl.style.display = 'block'
  resultEl.style.display = 'none'
  document.getElementById('btnSavePSA').style.display = 'none'

  try {
    _fetchedData = await lookupCert(certNum)

    document.getElementById('psaPreviewGrade').textContent = _fetchedData.grade ?? '—'
    document.getElementById('psaPreviewPop').textContent   = _fetchedData.pop   ?? '—'

    statusEl.style.display = 'none'
    resultEl.style.display = 'block'
    document.getElementById('btnSavePSA').style.display = 'block'
  } catch (err) {
    statusEl.style.color = '#C62828'
    statusEl.textContent = err.message || 'Lookup failed'
  } finally {
    btn.disabled = false
    btn.textContent = 'Look Up'
  }
}

export async function savePSAData() {
  if (!_fetchedData || !_cardId) return
  const btn = document.getElementById('btnSavePSA')
  btn.disabled = true
  btn.textContent = 'Saving…'
  try {
    await setDoc(doc(db, 'Cards', _cardId), {
      PSACert:  _fetchedData.cert,
      PSAPop:   _fetchedData.pop,
      PSAGrade: _fetchedData.grade,
    }, { merge: true })
    btn.disabled = false
    btn.textContent = 'Saved!'
    closePSASheet()
  } catch (e) {
    btn.disabled = false
    btn.textContent = '⚠ Save failed'
  }
}
