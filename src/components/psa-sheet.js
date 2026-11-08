import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'
import { registryUrl } from '../utils.js'
import { lookupPopulation } from '../services/population.js'

// Registry sheet: grading company, cert number and pop report for a graded
// card. Pop comes from Cardsight (PSA's free cert API was discontinued in
// Oct 2026); the cert itself is checked on the grader's own website.

let _cardId          = null
let _popHigher       = undefined   // set by a Cardsight lookup; undefined = untouched
let _scrimWasVisible = false

const $ = id => document.getElementById(id)

function syncRegistryLink() {
  const co   = $('reg_company')?.value
  const link = $('btnOpenRegistry')
  if (!link) return
  const url = registryUrl(co, $('psa_cert')?.value)
  link.textContent = `Open on ${co}`
  link.style.display = url ? 'flex' : 'none'
  if (url) link.href = url
}

function setStatus(text, error = false) {
  const el = $('psaFetchStatus')
  el.style.display = text ? 'block' : 'none'
  el.style.color   = error ? '#C62828' : 'var(--md-on-surface-variant)'
  el.textContent   = text
}

export function openPSASheet(cardId) {
  _cardId    = cardId
  _popHigher = undefined
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return

  const co = card['Grading Company'] || 'PSA'
  const companyEl = $('reg_company')
  companyEl.value    = ['PSA', 'BGS', 'SGC', 'CGC'].includes(co) ? co : 'PSA'
  companyEl.onchange = () => { syncRegistryLink(); setStatus('') }
  $('psa_cert').value   = card.PSACert || ''
  $('psa_cert').oninput = syncRegistryLink
  $('reg_pop').value    = card.PSAPop != null ? String(card.PSAPop) : ''

  setStatus(card.PSAPopAt ? `Pop last updated ${new Date(card.PSAPopAt).toLocaleDateString()}` : '')
  const titleEl = $('registrySheetTitle')
  if (titleEl) titleEl.textContent = `${co} Registry`

  const saveBtn = $('btnSavePSA')
  saveBtn.disabled    = false
  saveBtn.textContent = 'Save to Card'
  syncRegistryLink()

  const scrim = $('globalScrim')
  _scrimWasVisible = !!(scrim && scrim.style.display === 'block')
  if (scrim) { scrim.style.zIndex = '1150'; scrim.style.display = 'block' }
  $('psaSheet').classList.add('open')
}

export function closePSASheet() {
  const sheet = $('psaSheet')
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.classList.remove('open')
  sheet.style.transform = ''

  const scrim = $('globalScrim')
  if (scrim) {
    scrim.style.zIndex = '900'
    if (!_scrimWasVisible) scrim.style.display = 'none'
  }
}

export async function fetchPopulation() {
  const card = state.ALL_CARDS.find(c => c.id === _cardId)
  if (!card) return
  const btn = $('btnLookupPop')
  btn.disabled    = true
  btn.textContent = 'Checking Cardsight…'
  setStatus('')
  try {
    // Use the company picked in the sheet, in case it's being changed
    const r = await lookupPopulation({ ...card, 'Grading Company': $('reg_company').value })
    $('reg_pop').value = String(r.pop)
    _popHigher = r.popHigher
    const synced = r.syncedAt ? ` · synced ${new Date(r.syncedAt).toLocaleDateString()}` : ''
    setStatus(`${r.company} ${r.grade}: ${r.pop.toLocaleString()} graded, ${r.popHigher.toLocaleString()} higher (${r.variant})${synced}`)
  } catch (err) {
    setStatus(err.message || 'Lookup failed', true)
  } finally {
    btn.disabled    = false
    btn.textContent = 'Get pop from Cardsight'
  }
}

export async function savePSAData() {
  if (!_cardId) return
  const btn = $('btnSavePSA')
  const certVal    = $('psa_cert').value.trim()
  const popVal     = $('reg_pop').value.trim()
  const companyVal = $('reg_company').value

  btn.disabled    = true
  btn.textContent = 'Saving…'
  try {
    const updates = {
      PSACert: certVal || null,
      PSAPop:  popVal ? Number(popVal) : null,
    }
    if (_popHigher !== undefined) Object.assign(updates, { PSAPopHigher: _popHigher, PSAPopAt: Date.now() })
    const card = state.ALL_CARDS.find(c => c.id === _cardId)
    if (card && card['Grading Company'] !== companyVal) updates['Grading Company'] = companyVal

    await setDoc(doc(db, 'Cards', _cardId), updates, { merge: true })
    closePSASheet()
  } catch (e) {
    console.error('savePSAData error:', e)
  } finally {
    btn.disabled    = false
    btn.textContent = 'Save to Card'
  }
}
