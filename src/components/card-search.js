import { cardsight } from '../cardsight.js'
import * as state from '../state.js'
import { openCardForm } from './card-form.js'

const SPORT_MAP = {
  baseball: 'Baseball', football: 'Football', basketball: 'Basketball',
  hockey: 'Hockey', golf: 'Golf', soccer: 'Soccer',
}

let _ctx = null
let _scanObjectUrl = null

// ── Open / close ───────────────────────────────────────────────────────────
export function openCardSearch(ctx = 'player') {
  _ctx = ctx
  _clearResults()
  _setStatus('')
  document.getElementById('cs_query').value = ''
  document.getElementById('cs_clear').style.display = 'none'

  const sheet = document.getElementById('cardSearchSheet')
  sheet.classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.zIndex = '1150'
  scrim.style.display = 'block'

  setTimeout(() => document.getElementById('cs_query')?.focus(), 380)
}

export function closeCardSearch() {
  const sheet = document.getElementById('cardSearchSheet')
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.classList.remove('open')
  sheet.style.transform = ''
  if (_scanObjectUrl) { URL.revokeObjectURL(_scanObjectUrl); _scanObjectUrl = null }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _clearResults() {
  const el = document.getElementById('csResults')
  if (el) el.innerHTML = ''
}

function _setStatus(msg, isError = false) {
  const el = document.getElementById('cs_status')
  if (!el) return
  el.textContent = msg
  el.style.display = msg ? 'block' : 'none'
  el.style.color = isError ? 'var(--md-primary)' : 'var(--md-on-surface-variant)'
}

// ── Text search ────────────────────────────────────────────────────────────
export async function doCardSearch() {
  const q = (document.getElementById('cs_query')?.value || '').trim()
  if (q.length < 2) return

  _clearResults()
  _setStatus('Searching…')

  try {
    const { data, error } = await cardsight.catalog.search({ q, type: 'card', take: 20 })
    if (error || !data) { _setStatus('Search failed — check your API key', true); return }
    _setStatus('')
    _renderSearchResults(data.results || [])
  } catch (e) {
    _setStatus(e?.message || 'Search failed', true)
  }
}

function _renderSearchResults(results) {
  const el = document.getElementById('csResults')
  if (!results.length) {
    el.innerHTML = '<div class="cs-empty">No cards found. Try a different search.</div>'
    return
  }

  el.innerHTML = results.map((r, i) => {
    const meta = [r.year, r.setName || r.releaseName, r.manufacturerName].filter(Boolean).join(' · ')
    const parallel = r.parallelName ? `<span class="cs-parallel-tag">${r.parallelName}</span>` : ''
    return `
      <div class="cs-result-item" data-idx="${i}">
        <div class="cs-result-body">
          <div class="cs-result-name">${r.name}${parallel}</div>
          <div class="cs-result-meta">${meta}</div>
        </div>
        <span class="material-symbols-outlined cs-chevron">chevron_right</span>
      </div>`
  }).join('')

  el.querySelectorAll('.cs-result-item').forEach(item => {
    item.addEventListener('click', () => _selectSearchResult(results[+item.dataset.idx]))
  })
}

function _selectSearchResult(r) {
  _openWithPrefill({
    year:         r.year || '',
    set:          r.setName || '',
    manufacturer: r.manufacturerName || '',
    sport:        SPORT_MAP[(r.segment || '').toLowerCase()] || '',
    playerName:   r.name || '',
  })
}

// ── Scan / identify ────────────────────────────────────────────────────────
export async function doCardScan(file) {
  if (!file) return
  _clearResults()
  _setStatus('Identifying card…')

  try {
    const { data, error } = await cardsight.identify.card(file)
    if (error || !data) { _setStatus('Could not identify card', true); return }

    const detections = data.detections || []
    if (!detections.length) { _setStatus('No card detected — try a clearer photo', true); return }

    _setStatus('')
    if (_scanObjectUrl) URL.revokeObjectURL(_scanObjectUrl)
    _scanObjectUrl = URL.createObjectURL(file)
    _renderScanResults(detections, file, _scanObjectUrl)
  } catch (e) {
    _setStatus(e?.message || 'Scan failed', true)
  }
}

function _renderScanResults(detections, file, imgUrl) {
  const el = document.getElementById('csResults')
  const top = detections[0]
  const card = top.card
  const grading = top.grading

  const metaParts = [card.year, card.setName || card.releaseName, card.manufacturer].filter(Boolean)
  if (card.number) metaParts.push(`#${card.number}`)
  const parallel = card.parallel ? `<span class="cs-parallel-tag">${card.parallel.name}</span>` : ''
  const confClass = `cs-conf-${(top.confidence || 'low').toLowerCase()}`

  let html = `
    <div class="cs-scan-card">
      <img class="cs-scan-img" src="${imgUrl}" alt="Scanned card">
      <div class="cs-scan-info">
        <div class="cs-result-name">${card.name || 'Unknown'}${parallel}</div>
        <div class="cs-result-meta">${metaParts.join(' · ')}</div>
        ${grading ? `<div class="cs-result-meta">${grading.company?.name || ''} ${grading.grade?.value || ''}</div>` : ''}
        <span class="cs-conf-badge ${confClass}">${top.confidence}</span>
      </div>
    </div>
    <button class="expressive-btn" id="csUseCard" style="background:var(--md-primary);color:#fff;height:52px;border-radius:26px;margin-top:4px;">Use This Card</button>`

  const alts = detections.slice(1)
  if (alts.length) {
    html += `<div class="cs-alt-label">Other possibilities</div>`
    html += alts.map((det, i) => {
      const c = det.card
      const m = [c.year, c.setName || c.releaseName].filter(Boolean).join(' · ')
      return `<div class="cs-result-item" data-alt="${i}">
        <div class="cs-result-body">
          <div class="cs-result-name">${c.name || 'Unknown'}</div>
          <div class="cs-result-meta">${m}</div>
        </div>
        <span class="material-symbols-outlined cs-chevron">chevron_right</span>
      </div>`
    }).join('')
  }

  el.innerHTML = html

  document.getElementById('csUseCard').addEventListener('click', () =>
    _selectDetection(top, file, grading))

  el.querySelectorAll('[data-alt]').forEach(item => {
    item.addEventListener('click', () =>
      _selectDetection(detections[+item.dataset.alt + 1], file, null))
  })
}

function _selectDetection(detection, file, grading) {
  const card = detection.card
  const g = grading || detection.grading
  _openWithPrefill({
    year:           card.year || '',
    set:            card.setName || '',
    manufacturer:   card.manufacturer || '',
    number:         card.number || '',
    numbered:       !!card.numberedTo || !!(card.parallel?.numberedTo),
    playerName:     card.name || '',
    gradingCompany: g?.company?.name || '',
    grade:          g?.grade?.value || '',
    imageFile:      file,
    imagePreview:   _scanObjectUrl,
  })
}

// ── Handoff to card form ───────────────────────────────────────────────────
function _openWithPrefill(prefill) {
  closeCardSearch()
  // Keep scrim alive — openCardForm will re-assert it
  openCardForm(null, _ctx, prefill)
}

// ── Wire up DOM events ─────────────────────────────────────────────────────
export function initCardSearch() {
  const searchBtn = document.getElementById('csSearchBtn')
  const scanBtn   = document.getElementById('csScanBtn')
  const manualBtn = document.getElementById('csManualBtn')
  const input     = document.getElementById('cs_query')
  const clearBtn  = document.getElementById('cs_clear')
  const fileInput = document.getElementById('cs_fileInput')

  if (!searchBtn) return

  searchBtn.addEventListener('click', doCardSearch)

  input.addEventListener('keydown', e => { if (e.key === 'Enter') doCardSearch() })
  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? 'flex' : 'none'
  })
  clearBtn.addEventListener('click', () => {
    input.value = ''
    clearBtn.style.display = 'none'
    _clearResults()
    _setStatus('')
    input.focus()
  })

  scanBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (file) { doCardScan(file); fileInput.value = '' }
  })

  manualBtn.addEventListener('click', () => {
    closeCardSearch()
    const scrim = document.getElementById('globalScrim')
    if (scrim) { scrim.style.display = 'none' }
    openCardForm(null, _ctx)
  })
}
