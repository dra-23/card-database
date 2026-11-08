import { db, doc, setDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import * as state from '../state.js'
import { registryUrl, slabFields, subgradesText, labelTierName, getCleanImg, popAge } from '../utils.js'
import { lookupPopulation } from '../services/population.js'
import { findCardsightMatch } from '../services/market-value.js'
import { cardsight } from '../cardsight.js'

// Registry sheet: grading company, cert number and pop report for a graded
// card. Pop comes from Cardsight (PSA's free cert API was discontinued in
// Oct 2026); the cert itself is checked on the grader's own website.

let _cardId          = null
let _popHigher       = undefined   // set by a Cardsight lookup; undefined = untouched
let _slab            = null        // { grade, fields } read by Scan slab label
let _popVariant      = undefined   // version picked for the pop ('base' or parallel id)
let _linkId          = null        // Cardsight id found by a scan or auto-match, saved with the card
let _photos          = {}          // { front, back }: File to upload, null to remove; absent = unchanged
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

// "Which version is this card?" buttons, when Cardsight only has pop for
// other versions than the one expected
function renderChoices(choices) {
  const el = $('popChoices')
  if (!el) return
  el.innerHTML = ''
  el.style.display = choices?.length ? 'flex' : 'none'
  for (const c of choices || []) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'pop-choice'
    b.textContent = `${c.name} · ${c.total.toLocaleString()} graded`
    b.onclick = () => fetchPopulation(c.id)
    el.appendChild(b)
  }
}

// ── Your own slab photos (front / back) ────────────────────────────────────
function photoSrc(card, side) {
  const p = _photos[side]
  if (p instanceof File) return URL.createObjectURL(p)
  if (p === null) return ''
  return getCleanImg(side === 'front' ? card.PSAImage : card.PSAImageBack) || ''
}

function renderPhotos(card) {
  for (const side of ['front', 'back']) {
    const tile = document.querySelector(`.slab-photo[data-side="${side}"]`)
    if (!tile) continue
    const src = photoSrc(card, side)
    tile.classList.toggle('has-photo', !!src)
    tile.querySelector('img').src = src || ''
    tile.querySelector('.slab-photo-remove').hidden = !src
  }
}

export function pickSlabPhoto(side) {
  const input = $('slabPhotoInput')
  input.value = ''
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    _photos[side] = file
    renderPhotos(state.ALL_CARDS.find(c => c.id === _cardId) || {})
  }
  input.click()
}

export function removeSlabPhoto(side) {
  _photos[side] = null
  renderPhotos(state.ALL_CARDS.find(c => c.id === _cardId) || {})
}

async function uploadPhoto(file) {
  const snap = await uploadBytes(ref(storage, `slabs/${Date.now()}_${file.name || 'slab.jpg'}`), file)
  return getDownloadURL(snap.ref)
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
  _slab      = null
  _popVariant = undefined
  _linkId    = null
  _photos    = {}
  renderChoices(null)
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return
  renderPhotos(card)

  const co = card['Grading Company'] || 'PSA'
  const companyEl = $('reg_company')
  companyEl.value    = ['PSA', 'BGS', 'SGC', 'CGC'].includes(co) ? co : 'PSA'
  companyEl.onchange = () => { syncRegistryLink(); setStatus('') }
  $('psa_cert').value   = card.PSACert || ''
  $('psa_cert').oninput = syncRegistryLink
  $('reg_pop').value    = card.PSAPop != null ? String(card.PSAPop) : ''

  setStatus(card.PSAPopAt ? `Pop last updated ${popAge(card.PSAPopAt)}` : '')
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

function _pendingCard(card) {
  return {
    ...card,
    ...(_linkId && !card.CardsightId ? { CardsightId: _linkId } : {}),
    ...(_slab?.fields || {}),
    ...(_slab?.grade ? { Grade: _slab.grade } : {}),
    'Grading Company': $('reg_company').value,
  }
}

// One photo of the slab does it all: Cardsight identifies the card (linking
// it if it isn't yet) and reads the label (company, grade, cert, subgrades,
// label tier), then the pop is fetched. The photo also becomes the slab's
// front picture if it has none. Nothing is saved until Save to Card.
export function scanSlab() {
  const input = $('slabFileInput')
  input.value = ''
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const btn = $('btnScanSlab')
    btn.disabled = true
    btn.lastChild.textContent = 'Reading label…'
    setStatus('')
    try {
      const { data, error } = await cardsight.identify.card(file)
      if (error) throw new Error(error?.error === 'budget' ? 'Monthly Cardsight limit reached.' : 'Couldn’t reach Cardsight. Try again later.')
      const det = data?.detections?.[0]
      const grading = det?.grading
      if (!grading?.company?.name) throw new Error('Couldn’t read a slab label in that photo. Try a straight-on shot of the label.')

      const company = grading.company.name.toUpperCase()
      const known = ['PSA', 'BGS', 'SGC', 'CGC']
      const fields = slabFields(grading)
      _slab = { grade: grading.grade?.value || null, fields }
      if (known.includes(company)) $('reg_company').value = company
      if (fields.PSACert) $('psa_cert').value = fields.PSACert
      syncRegistryLink()

      const card = state.ALL_CARDS.find(c => c.id === _cardId)
      // Link to Cardsight from the same photo; an existing link is kept
      let linkNote = ''
      if (det.card?.id && !card?.CardsightId) { _linkId = det.card.id; linkNote = ' Matched on Cardsight.' }
      // Use the photo as the slab picture if there isn't one
      if (card && !card.PSAImage && !(_photos.front instanceof File)) { _photos.front = file; renderPhotos(card) }
      const parts = [
        `${company}${_slab.grade ? ' ' + _slab.grade : ''}`,
        labelTierName(fields.LabelTier),
        fields.PSACert ? `Cert ${fields.PSACert}` : 'cert not readable',
        fields.Subgrades && subgradesText(fields.Subgrades),
        fields.AutoGrade && `Auto ${fields.AutoGrade}`,
      ].filter(Boolean)
      const gradeChange = _slab.grade && card && String(card.Grade) !== String(_slab.grade)
        ? ` Grade will change from ${card.Grade || 'none'} to ${_slab.grade} when saved.` : ''
      const lowConf = grading.confidence === 'Low' ? ' (low confidence, please check)' : ''
      const readMsg = `Read: ${parts.join(' · ')}${lowConf}.${gradeChange}${linkNote}`
      setStatus(readMsg + (known.includes(company) ? '' : ` ${company} isn't supported here.`))
      btn.disabled = false
      btn.lastChild.textContent = 'Scan slab label'
      if (known.includes(company)) await fetchPopulation(undefined, readMsg)
    } catch (err) {
      setStatus(err.message || 'Scan failed', true)
    } finally {
      btn.disabled = false
      btn.lastChild.textContent = 'Scan slab label'
    }
  }
  input.click()
}

export async function fetchPopulation(variantId, prefix = '') {
  const card = state.ALL_CARDS.find(c => c.id === _cardId)
  if (!card) return
  const btn = $('btnLookupPop')
  btn.disabled    = true
  btn.textContent = 'Checking Cardsight…'
  const lead = typeof prefix === 'string' && prefix ? prefix + '\n' : ''
  setStatus(lead)
  try {
    renderChoices(null)
    // Not linked to Cardsight yet: try to match it now rather than stopping
    if (!card.CardsightId && !_linkId) {
      const player = state.ALL_PLAYERS.find(p => p.id === card.Player)
      btn.textContent = 'Finding card on Cardsight…'
      _linkId = await findCardsightMatch(card, player?.Player || card.Player || '')
        .catch(e => { throw new Error(e.budget ? 'Monthly Cardsight limit reached.' : 'Couldn’t reach Cardsight. Try again later.') })
      if (!_linkId) throw Object.assign(new Error('Couldn’t find this card on Cardsight automatically. Try Scan slab label, or match it under Market Value → Find on Cardsight.'), { manual: true })
      btn.textContent = 'Checking Cardsight…'
    }
    // Use what the sheet will save: a scanned grade / label tier and the
    // company picked here, in case they differ from the card's
    const r = await lookupPopulation(_pendingCard(card), { variantId: typeof variantId === 'string' ? variantId : undefined })
    $('reg_pop').value = String(r.pop)
    _popHigher = r.popHigher
    _popVariant = r.variantId
    const synced = r.syncedAt ? ` · synced ${new Date(r.syncedAt).toLocaleDateString()}` : ''
    setStatus(`${lead}${r.company} ${r.grade}: ${r.pop.toLocaleString()} graded, ${r.popHigher.toLocaleString()} higher (${r.variant})${synced}`)
  } catch (err) {
    // A version question isn't an error, so it isn't shown in red
    const co = $('reg_company').value
    const manual = !err.choices?.length && $('psa_cert').value.trim()
      ? ` You can copy the pop from ${co}'s site with Open on ${co} and type it in above.` : ''
    setStatus(lead + (err.message || 'Lookup failed') + manual, !err.choices?.length)
    renderChoices(err.choices)
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
    if (_popHigher !== undefined) Object.assign(updates, { PSAPopHigher: _popHigher, PSAPopAt: Date.now(), PopVariant: _popVariant })
    if (_slab) {
      // A fresh scan replaces the old label details (a re-slab or regrade)
      Object.assign(updates, { Subgrades: null, LabelTier: null, AutoGrade: null, GradeQualifier: null }, _slab.fields)
      if (_slab.grade) updates.Grade = _slab.grade
      if (certVal) updates.PSACert = certVal  // the field wins if it was edited after the scan
    }
    const card = state.ALL_CARDS.find(c => c.id === _cardId)
    if (card && card['Grading Company'] !== companyVal) updates['Grading Company'] = companyVal
    if (_linkId && card && !card.CardsightId) updates.CardsightId = _linkId
    for (const [side, field] of [['front', 'PSAImage'], ['back', 'PSAImageBack']]) {
      if (_photos[side] === null) updates[field] = null
      else if (_photos[side] instanceof File) { btn.textContent = 'Uploading photo…'; updates[field] = await uploadPhoto(_photos[side]) }
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
