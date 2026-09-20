import { db, doc, setDoc, ref, uploadBytes, getDownloadURL, storage } from '../firebase.js'
import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr, sheetTransformY, vibrate } from '../utils.js'
import { promptPrice } from './price-prompt.js'
import { promptNotes } from './notes-prompt.js'
import { isWideLayout, isFoldLayout, isThreePaneLayout } from '../layout.js'
import { closeCardSheets } from '../gestures.js'
import { openCardForm } from './card-form.js'
import { cardsight } from '../cardsight.js'

// ── Icons (inline, currentColor so they theme for free) ───────────────────
const ICON_KEBAB    = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.8" fill="currentColor"></circle><circle cx="12" cy="12" r="1.8" fill="currentColor"></circle><circle cx="12" cy="19" r="1.8" fill="currentColor"></circle></svg>`
const ICON_ZOOM      = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="20" y1="20" x2="15.3" y2="15.3"></line></svg>`
const ICON_CHECK     = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`
const ICON_STAR      = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z"></path></svg>`
const ICON_SHARE     = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.1"></circle><circle cx="17" cy="6" r="2.1"></circle><circle cx="17" cy="18" r="2.1"></circle><line x1="8" y1="10.8" x2="15" y2="7.2"></line><line x1="8" y1="13.2" x2="15" y2="16.8"></line></svg>`
const ICON_PENCIL    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg>`
const ICON_ARROW     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M8 7h9v9"></path></svg>`
const ICON_TRASH     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path></svg>`
const ICON_REFRESH   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 5.7"></path><path d="M20 5v6h-6"></path></svg>`
const ICON_CALENDAR  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="3" x2="8" y2="7"></line><line x1="16" y1="3" x2="16" y2="7"></line></svg>`
const ICON_LAYERS    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"></path><path d="M3 13l9 5 9-5"></path></svg>`
const ICON_HASH      = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="9" y1="4" x2="7" y2="20"></line><line x1="17" y1="4" x2="15" y2="20"></line><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line></svg>`
const ICON_BOX       = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"></path><path d="M3 8v8l9 5 9-5V8"></path><line x1="12" y1="13" x2="12" y2="21"></line></svg>`
const ICON_SPORT     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"></circle><path d="M6 5.5c2 2 3 4.5 3 6.5s-1 4.5-3 6.5"></path><path d="M18 5.5c-2 2-3 4.5-3 6.5s1 4.5 3 6.5"></path></svg>`
const ICON_TEAM      = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"></path></svg>`
const ICON_TAG       = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 12.6L12.4 20.8a2 2 0 01-2.8 0L3 14.2V4h10.2l7.4 7.4a2 2 0 010 2.8z"></path><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>`

function isFavorite(card) {
  return card.Favorite === true || card.Favorite === 'true'
}

function _showToast(msg) {
  const el = document.createElement('div')
  el.className = 'cd2-toast'
  el.textContent = msg
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250) }, 1600)
}

async function _handleShare(card, playerName) {
  const parts = [card.Year, card.Set, card.Number ? `#${card.Number}` : ''].filter(Boolean)
  const text  = [playerName, parts.join(' ')].filter(Boolean).join(' — ')
  const url   = card['Card Information'] || ''
  try {
    if (navigator.share) {
      await navigator.share({ title: playerName || 'Card', text, ...(url ? { url } : {}) })
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text)
      _showToast('Copied to clipboard')
    }
  } catch (e) {
    if (e?.name !== 'AbortError') console.error('[share]', e)
  }
}

// ── Card detail HTML ───────────────────────────────────────────────────────
export function buildCardDetailHTML(card, ctx) {
  const player      = state.ALL_PLAYERS.find(p => p.id === card.Player)
  const playerName  = player ? (player.Player || player.id) : (card.Player || '')
  const co          = card['Grading Company'] || ''
  const gr          = card.Grade || ''
  const gradeStr    = (co && co !== 'Raw') ? `${co} ${gr}` : ''
  const owned       = isOwned(card)
  const url         = card['Card Information'] || ''
  const parallel    = card.Parallel || ''
  const serial      = card.SerialNumber || card.Serial || card['Serial Number'] || ''
  const notes       = card.Notes || ''
  const isRC        = card.RC       === true || card.RC       === 'true'
  const isAuto      = card.Auto     === true || card.Auto     === 'true'
  const isMem       = card.Mem === true || card.Mem === 'true' || card.Patch === true || card.Patch === 'true'
  const isNumbered  = card.Numbered === true || card.Numbered === 'true'
  const ebayQ       = encodeURIComponent([card.Year, card.Set, playerName, card.Number ? `#${card.Number}` : '', parallel].filter(Boolean).join(' ').trim())
  const ebayUrl     = `https://www.ebay.com/sch/i.html?_nkw=${ebayQ}&LH_Sold=1&LH_Complete=1`
  const tcdbUrl     = url  // Card Information field IS the TCDB link

  const stats = [
    ['Year',         card.Year,                          ICON_CALENDAR],
    ['Set',          card.Set,                            ICON_LAYERS],
    ['Card Number',  card.Number ? `#${card.Number}` : null, ICON_HASH],
    ['Manufacturer', card.Manufacturer,                   ICON_BOX],
    ['Sport',        card.Sport,                          ICON_SPORT],
    ['Team',         card.Team,                           ICON_TEAM],
    ...(parallel ? [['Parallel', parallel, ICON_TAG]] : []),
    ...(serial   ? [['Serial',   serial,   ICON_TAG]] : []),
  ]

  const isGraded    = co && co !== 'Raw'
  const hasPSA      = isGraded && !!card.PSACert
  const hasPSAImages = !!(card.PSAImage || card.PSAImageBack)
  const registryUrl = hasPSA ? (() => {
    switch (co) {
      case 'PSA': return `https://www.psacard.com/cert/${card.PSACert}`
      case 'BGS': return `https://www.beckett.com/grading/card-lookup?item_id=${card.PSACert}`
      case 'SGC': return `https://www.gosgc.com/cert-code-lookup?cert_code=${card.PSACert}`
      case 'CGC': return `https://www.cgccards.com/certlookup/${card.PSACert}`
      default:    return ''
    }
  })() : ''
  const psaSection = isGraded ? `
    <div class="cd2-section">
      <div class="cd2-section-label-row">
        <span class="cd2-section-label">${co} Registry Data</span>
        <button class="cd2-edit-icon-btn" data-psa-edit="${escapeAttr(card.id)}" aria-label="Edit grading info">${ICON_PENCIL}</button>
      </div>
      <div class="cd2-card" data-co="${co}">
        ${hasPSA ? `
        <div class="cd2-card-rows">
          <div class="cd2-row"><span class="cd2-row-lbl">Cert #</span><span class="cd2-row-val">${card.PSACert}</span></div>
          ${card.PSAGrade ? `<div class="cd2-row"><span class="cd2-row-lbl">Grade</span><span class="cd2-grade-pill" data-co="${co}">${card.PSAGrade}</span></div>` : ''}
          <div class="cd2-row"><span class="cd2-row-lbl">Pop Report</span><span class="cd2-row-val">${card.PSAPop ?? '—'}</span></div>
        </div>
        ${registryUrl ? `<a href="${registryUrl}" target="_blank" rel="noopener" class="cd2-card-action cd2-btn-registry" data-co="${co}">${co} Registry ${ICON_ARROW}</a>` : ''}` : `
        <button class="cd2-link-row" data-psa-edit="${escapeAttr(card.id)}">
          <span>Link ${co} cert #</span>${ICON_ARROW}
        </button>`}
      </div>
    </div>` : ''

  const sameSetCards = (card.Year && card.Set)
    ? state.ALL_CARDS
        .filter(c => c.id !== card.id && c.Year === card.Year && c.Set === card.Set && c.Sport === card.Sport)
        .sort((a, b) => String(a.Number ?? '').localeCompare(String(b.Number ?? ''), undefined, { numeric: true }))
    : []

  const setPreviewSection = sameSetCards.length > 0 ? `
    <div class="set-preview-section">
      <div class="set-preview-title">More from ${card.Year} ${card.Set}</div>
      ${sameSetCards.map(c => {
        const p = state.ALL_PLAYERS.find(pl => pl.id === c.Player)
        const pName = p ? (p.Player || p.id) : (c.Player || '')
        const co2 = c['Grading Company'] || '', gr2 = c.Grade || ''
        const cRC  = c.RC   === true || c.RC   === 'true'
        const cAut = c.Auto === true || c.Auto === 'true'
        const cMem = c.Mem  === true || c.Mem  === 'true' || c.Patch === true || c.Patch === 'true'
        const cNum = c.Numbered === true || c.Numbered === 'true'
        const cb1 = (co2 && co2 !== 'Raw') ? `<span class="badge-grade" data-co="${co2}">${co2} ${gr2}</span>` : ''
        const cb2 = cRC  ? `<span class="badge-rc">RC</span>`         : ''
        const cb3 = cAut ? `<span class="badge-auto">AUTO</span>`     : ''
        const cb4 = cMem ? `<span class="badge-mem">MEM</span>`       : ''
        const cb5 = cNum ? `<span class="badge-numbered">#'d</span>`  : ''
        const cBadges = cb1 + cb2 + cb3 + cb4 + cb5
        return `<div class="card-item ${isOwned(c) ? '' : 'not-owned'} set-preview-row" data-set-card-id="${escapeAttr(c.id)}">
          <img class="card-thumb" src="${getCleanImg(c['App Image'])}" alt="" loading="lazy">
          <div class="card-info">
            <div class="card-info-row1">${c.Set || ''} #${c.Number || 'N/A'}</div>
            <div class="card-info-row2">${pName}</div>
            ${cBadges ? `<div class="card-badge-tray">${cBadges}</div>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>` : ''

  const pricePaid   = card.Price ? `$${parseFloat(card.Price).toFixed(2)}` : '—'
  const fav         = isFavorite(card)
  const yearSetNum  = [card.Year, card.Set].filter(Boolean).join(' ') + (card.Number ? ` #${card.Number}` : '')

  const heroSection = hasPSAImages ? `
    <div class="cd2-hero-imgs">
      ${card.PSAImage     ? `<div class="cd2-hero-img-wrap cd2-hero-img-wrap-half"><img class="cd2-hero-img cd2-psa-main-img" src="${card.PSAImage}" alt="front"></div>` : ''}
      ${card.PSAImageBack ? `<div class="cd2-hero-img-wrap cd2-hero-img-wrap-half"><img class="cd2-hero-img cd2-psa-main-img" src="${card.PSAImageBack}" alt="back"></div>` : ''}
    </div>` : `
    <div class="cd2-hero-img-wrap">
      <img class="cd2-hero-img cd2-single-img" src="${getCleanImg(card['App Image'])}" alt="${escapeAttr(card.Set)}">
      <button type="button" class="cd2-zoom-btn" data-zoom-single aria-label="Zoom card image">${ICON_ZOOM}</button>
    </div>`

  const marketSection = `
    <div class="cd2-section">
      <span class="cd2-section-label">Market Value</span>
      <div class="cd2-card cd2-market-card">
        <div class="cd2-market-stats">
          <div class="cd2-market-stat">
            <span class="cd2-market-lbl">Purchase Price</span>
            <span class="cd2-market-val">${pricePaid}</span>
          </div>
          <div class="cd2-market-divider"></div>
          <div class="cd2-market-stat">
            <span class="cd2-market-lbl">Market Value</span>
            <span class="cd2-market-val ${card.CardsightId ? '' : 'cd2-market-muted'}" data-mv-value>${card.CardsightId ? 'Fetching…' : 'Not synced'}</span>
          </div>
        </div>
        <div class="cd2-market-change-row" data-mv-change-row style="display:none">
          <span class="cd2-market-lbl">Gain / Loss</span>
          <span class="cd2-market-val" data-mv-change></span>
        </div>
        ${card.CardsightId
          ? `<button type="button" class="cd2-check-value-btn" data-mv-refresh>${ICON_REFRESH} Refresh value</button>`
          : `<button type="button" class="cd2-check-value-btn" data-mv-check>${ICON_REFRESH} Check current value</button>`}
      </div>
    </div>`

  const notesSection = notes ? `
    <div class="cd2-section">
      <span class="cd2-section-label">Notes</span>
      <button type="button" class="cd2-notes-btn cd2-notes-filled" data-notes-btn="${escapeAttr(card.id)}">
        <span class="cd2-notes-text">${notes}</span>
        ${ICON_PENCIL}
      </button>
    </div>` : `
    <div class="cd2-section">
      <span class="cd2-section-label">Notes</span>
      <button type="button" class="cd2-notes-btn" data-notes-btn="${escapeAttr(card.id)}">
        <span class="cd2-notes-placeholder">Add notes on condition, provenance, or where you found this card…</span>
        ${ICON_PENCIL}
      </button>
    </div>`

  return `
    <div class="cd2-hero">
      <div class="cd2-hero-glow"></div>
      ${heroSection}
    </div>

    <div class="cd2-title-block">
      <h1 class="cd2-player-name">${playerName}</h1>
      <p class="cd2-subtitle">${yearSetNum}</p>
      ${(gradeStr || isRC || isAuto || isMem || isNumbered) ? `<div class="cd2-badge-row">
        ${gradeStr   ? `<span class="badge-grade" data-co="${co}">${gradeStr}</span>`   : ''}
        ${isRC       ? `<span class="badge-rc">RC</span>`               : ''}
        ${isAuto     ? `<span class="badge-auto">AUTO</span>`           : ''}
        ${isMem      ? `<span class="badge-mem">MEM</span>`             : ''}
        ${isNumbered ? `<span class="badge-numbered">#'d</span>`        : ''}
      </div>` : ''}
    </div>

    <div class="cd2-quick-actions">
      <div class="cd2-qa-item">
        <button type="button" class="cd2-qa-btn cd2-qa-sleeve ${owned ? 'active' : ''}" data-card-toggle="${escapeAttr(card.id)}" aria-pressed="${owned}" aria-label="Sleevd">${ICON_CHECK}</button>
        <span class="cd2-qa-label">Sleevd</span>
      </div>
      <div class="cd2-qa-item">
        <button type="button" class="cd2-qa-btn cd2-qa-fav ${fav ? 'active' : ''}" data-fav-toggle="${escapeAttr(card.id)}" aria-pressed="${fav}" aria-label="Favorite">${ICON_STAR}</button>
        <span class="cd2-qa-label">Favorite</span>
      </div>
      <div class="cd2-qa-item">
        <button type="button" class="cd2-qa-btn cd2-qa-share" data-share-btn aria-label="Share card">${ICON_SHARE}</button>
        <span class="cd2-qa-label">Share</span>
      </div>
      <div class="cd2-qa-item">
        <button type="button" class="cd2-qa-btn cd2-qa-more" data-card-menu="${escapeAttr(card.id)}" aria-label="Card options">${ICON_KEBAB}</button>
        <span class="cd2-qa-label">Manage</span>
      </div>
    </div>

    <div class="cd2-section">
      <div class="cd2-section-label-row">
        <span class="cd2-section-label">Card Details</span>
        <button class="cd2-edit-icon-btn" data-card-edit="${escapeAttr(card.id)}" aria-label="Edit card details">${ICON_PENCIL}</button>
      </div>
      <div class="cd2-card">
        <div class="cd2-card-rows">
          ${stats.filter(([, val]) => val).map(([lbl, val, icon]) => `
            <div class="cd2-row">
              <span class="cd2-row-lbl">${icon}<span>${lbl}</span></span>
              <span class="cd2-row-val">${val}</span>
            </div>`).join('')}
        </div>
        <div class="cd2-card-action-row">
          <a href="${ebayUrl}" target="_blank" rel="noopener" class="cd2-card-action cd2-btn-ebay">eBay Sold ${ICON_ARROW}</a>
          ${tcdbUrl ? `<a href="${tcdbUrl}" target="_blank" rel="noopener" class="cd2-card-action cd2-btn-tcdb">TCDB ${ICON_ARROW}</a>` : ''}
        </div>
      </div>
    </div>

    ${psaSection}
    ${marketSection}
    ${notesSection}

    <div class="cd2-section">
      <span class="cd2-section-label">Manage</span>
      <div class="cd2-card">
        <button type="button" class="cd2-manage-row" data-manage-delete="${escapeAttr(card.id)}">
          ${ICON_TRASH}<span>Remove from Collection</span>
        </button>
      </div>
    </div>

    ${setPreviewSection}
  `
}

// ── Market value async loader ──────────────────────────────────────────────
const _mvGen = new WeakMap()

async function _loadMarketValue(panelEl, card) {
  if (!card.CardsightId) return
  const gen = (_mvGen.get(panelEl) || 0) + 1
  _mvGen.set(panelEl, gen)
  const alive = () => _mvGen.get(panelEl) === gen

  try {
    const { data, error } = await cardsight.pricing.get(card.CardsightId)
    if (!alive()) return
    const valEl     = panelEl.querySelector('[data-mv-value]')
    const changeRow = panelEl.querySelector('[data-mv-change-row]')
    const changeEl  = panelEl.querySelector('[data-mv-change]')
    if (!valEl) return

    if (error || !data) { valEl.textContent = 'N/A'; valEl.classList.add('cd2-market-muted'); return }

    const co = card['Grading Company']
    const gr = String(card.Grade || '')

    let records = null
    if (co && co !== 'Raw' && data.graded?.length) {
      const cg = data.graded.find(g => g.company_name === co) || data.graded[0]
      const gg = cg?.grades?.find(g => g.grade_value === gr) || cg?.grades?.[0]
      if (gg?.records?.length) records = gg.records
    }
    if (!records?.length && data.raw?.records?.length) records = data.raw.records
    if (!records?.length) { valEl.textContent = 'No data'; valEl.classList.add('cd2-market-muted'); return }

    const avg = records.reduce((s, r) => s + r.price, 0) / records.length
    const lastDate = records[0]?.date ? new Date(records[0].date).toLocaleDateString() : null
    valEl.textContent = `$${avg.toFixed(2)}`
    valEl.classList.remove('cd2-market-muted')
    if (lastDate) valEl.title = `Avg of ${records.length} sale${records.length !== 1 ? 's' : ''} · Last: ${lastDate}`

    if (card.Price && changeRow && changeEl) {
      const paid = parseFloat(card.Price)
      if (!isNaN(paid) && paid > 0) {
        const diff = avg - paid
        const pct  = ((diff / paid) * 100).toFixed(1)
        const sign = diff >= 0 ? '+' : ''
        changeEl.textContent = `${sign}$${diff.toFixed(2)} (${sign}${pct}%)`
        changeEl.className = `cd2-market-val ${diff >= 0 ? 'market-gain' : 'market-loss'}`
        changeRow.style.display = ''
      }
    }
  } catch {
    if (!alive()) return
    const v = panelEl.querySelector('[data-mv-value]')
    if (v) { v.textContent = 'N/A'; v.classList.add('cd2-market-muted') }
  }
}

// ── Find a CardsightId via text search, then load pricing ─────────────────
export async function findAndLoadMarketValue(cardId, panelEl) {
  const c = state.ALL_CARDS.find(x => x.id === cardId)
  if (!c) return
  const player     = state.ALL_PLAYERS.find(p => p.id === c.Player)
  const playerName = player ? (player.Player || player.id) : (c.Player || '')
  const valEl = panelEl?.querySelector('[data-mv-value]')
  if (valEl) { valEl.textContent = 'Searching…'; valEl.classList.add('cd2-market-muted') }

  // Card number excluded — including it causes 0 results in CardSight text search.
  // Year-first ordering matches CardSight's release indexing.
  const seen = new Set()
  const queries = [
    [c.Year, playerName, c.Set          ],
    [c.Year, playerName, c.Manufacturer ],
    [c.Year, playerName                 ],
    [playerName,         c.Manufacturer ],
    [playerName,         c.Set          ],
  ]
    .map(parts => parts.filter(Boolean).join(' ').trim())
    .filter(q => q && !seen.has(q) && seen.add(q))

  try {
    let cardsightId = null
    for (const q of queries) {
      const { data, error } = await cardsight.catalog.search({ q, type: 'card', take: 5 })
      if (!error && data?.results?.length) { cardsightId = data.results[0].id; break }
    }
    if (!cardsightId) {
      if (valEl && document.contains(valEl)) valEl.textContent = 'Not found'
      return
    }
    await setDoc(doc(db, 'Cards', cardId), { CardsightId: cardsightId }, { merge: true })
    if (panelEl && document.contains(panelEl)) _loadMarketValue(panelEl, { ...c, CardsightId: cardsightId })
  } catch (e) {
    console.error('[findAndLoadMarketValue]', e)
    if (valEl && document.contains(valEl)) valEl.textContent = 'Error'
  }
}

// ── Render card into a panel element ──────────────────────────────────────
export function renderCardPanelInto(panelEl, cardId, ctx) {
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return
  panelEl.innerHTML = buildCardDetailHTML(card, ctx)
  panelEl.scrollTop = 0

  // Toggle sleeved (owned)
  panelEl.querySelector(`[data-card-toggle]`)?.addEventListener('click', async () => {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    const markingSleevd = !isOwned(c)
    const updates = { Owned: markingSleevd }
    if (markingSleevd) {
      const price = await promptPrice()
      if (price !== null) updates.Price = String(price)
    }
    await setDoc(doc(db, 'Cards', cardId), updates, { merge: true })
  })

  // Toggle favorite
  panelEl.querySelector('[data-fav-toggle]')?.addEventListener('click', async () => {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    await setDoc(doc(db, 'Cards', cardId), { Favorite: !isFavorite(c) }, { merge: true })
  })

  // Share
  panelEl.querySelector('[data-share-btn]')?.addEventListener('click', () => {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    const player = state.ALL_PLAYERS.find(p => p.id === c.Player)
    _handleShare(c, player ? (player.Player || player.id) : (c.Player || ''))
  })

  // Card details edit button
  panelEl.querySelector('[data-card-edit]')?.addEventListener('click', () => {
    openCardForm(cardId)
  })

  // 3-dot menu
  panelEl.querySelector(`[data-card-menu]`)?.addEventListener('click', e => {
    window._openRowMenu?.(cardId, e.currentTarget)
  })

  // PSA edit / link
  panelEl.querySelector('[data-psa-edit]')?.addEventListener('click', () => {
    window._openPSASheet?.(cardId)
  })

  // Notes add/edit
  panelEl.querySelector('[data-notes-btn]')?.addEventListener('click', async () => {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    const result = await promptNotes(c.Notes || '')
    if (result !== null) await setDoc(doc(db, 'Cards', cardId), { Notes: result }, { merge: true })
  })

  // Remove from Collection (delete)
  panelEl.querySelector('[data-manage-delete]')?.addEventListener('click', () => {
    window._confirmDeleteCard?.(cardId)
  })

  // Same-set card preview taps
  panelEl.querySelectorAll('[data-set-card-id]').forEach(el => {
    el.addEventListener('click', () => handleCardTap(el.dataset.setCardId, ctx, true))
  })

  // Market value: check (no CardsightId yet) / refresh (already synced)
  panelEl.querySelector('[data-mv-check]')?.addEventListener('click', () => {
    findAndLoadMarketValue(cardId, panelEl)
  })
  panelEl.querySelector('[data-mv-refresh]')?.addEventListener('click', () => {
    const valEl = panelEl.querySelector('[data-mv-value]')
    if (valEl) { valEl.textContent = 'Fetching…'; valEl.classList.add('cd2-market-muted') }
    const changeRow = panelEl.querySelector('[data-mv-change-row]')
    if (changeRow) changeRow.style.display = 'none'
    _loadMarketValue(panelEl, card)
  })

  // Kick off pricing fetch if card has a CardsightId
  _loadMarketValue(panelEl, card)

  // Hero image(s) — click to enlarge, consistent with graded front/back
  const singleImg = panelEl.querySelector('.cd2-single-img')
  if (singleImg) {
    const openSingle = () => window._openLightbox?.([singleImg.src], 0)
    singleImg.addEventListener('click', openSingle)
    panelEl.querySelector('[data-zoom-single]')?.addEventListener('click', openSingle)
  }
  const mainPSAImgs = [...panelEl.querySelectorAll('.cd2-psa-main-img')]
  mainPSAImgs.forEach((img, i) => {
    img.addEventListener('click', () => {
      window._openLightbox?.(mainPSAImgs.map(im => im.src), i)
    })
  })
}

export function refreshCurrentCardPanel(cardId) {
  if (!cardId || cardId !== state.currentCardId) return
  const ctx = state.activeCardContext

  if (ctx === 'player') {
    const panel = isFoldLayout()
      ? document.getElementById('twoPane-panel')
      : document.getElementById('cardDetailPanel')
    if (panel) renderCardPanelInto(panel, cardId, ctx)
  } else if (ctx === 'collection') {
    const panel = isWideLayout()
      ? document.getElementById('twoPane-coll-panel')
      : document.getElementById('collectionCardPanel')
    if (panel) renderCardPanelInto(panel, cardId, ctx)
  } else {
    const panel = isWideLayout()
      ? document.getElementById('twoPane-grad-panel')
      : document.getElementById('gradedCardPanel')
    if (panel) renderCardPanelInto(panel, cardId, ctx)
  }
}

// ── handleCardTap ─────────────────────────────────────────────────────────
export function handleCardTap(cardId, ctx, replace = false) {
  state.setCurrentCardId(cardId)
  state.setActiveCardContext(ctx || 'player')

  const useInlinePanel = ctx === 'player' ? isFoldLayout() : isWideLayout()

  if (useInlinePanel) {
    const panelMap = {
      player:     ['twoPane-panel',      'twoPane-empty',      '.card-item'],
      collection: ['twoPane-coll-panel', 'twoPane-coll-empty', '#collectionList .card-item'],
      graded:     ['twoPane-grad-panel', 'twoPane-grad-empty', '#gradedList .graded-tile'],
    }
    const [panelId, emptyId, rowSel] = panelMap[ctx] || panelMap.player
    const selectorClass = ctx === 'graded' ? '.graded-tile.tp-selected' : '.card-item.tp-selected'

    document.querySelectorAll(selectorClass).forEach(el => el.classList.remove('tp-selected'))
    const rowEl = document.querySelector(`${rowSel}[data-card-id="${cardId}"]`)
    if (rowEl) rowEl.classList.add('tp-selected')

    const emptyEl = document.getElementById(emptyId)
    const panel   = document.getElementById(panelId)
    if (emptyEl) emptyEl.style.display = 'none'
    if (panel)   { panel.style.display = 'flex'; panel.classList.remove('animating'); panel.style.transform = ''; renderCardPanelInto(panel, cardId, ctx) }
  } else {
    const sheetIds = { player: 'cardDetailSheet', collection: 'collectionCardSheet', graded: 'gradedCardSheet' }
    const panelIds = { player: 'cardDetailPanel', collection: 'collectionCardPanel', graded: 'gradedCardPanel' }
    const sheetId = sheetIds[ctx] || 'cardDetailSheet'
    const panelId = panelIds[ctx] || 'cardDetailPanel'

    const panel = document.getElementById(panelId)
    if (panel) { panel.classList.remove('animating'); panel.style.transform = ''; renderCardPanelInto(panel, cardId, ctx) }

    const sheet = document.getElementById(sheetId)
    if (sheet) { sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'; sheet.style.transform = ''; sheet.classList.add('open') }

    const scrim  = document.getElementById('globalScrim')
    const nb     = document.getElementById('nav-bar')
    if (scrim) scrim.style.display = 'block'
    if (nb)    { nb.style.transform = 'translateX(-50%) translateY(calc(100% + 32px + env(safe-area-inset-bottom)))'; nb.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)' }

    if (replace) history.replaceState({ v: 'card', id: cardId, ctx }, '')
    else         history.pushState({ v: 'card', id: cardId, ctx }, '')
  }
}

// ── Card navigation (prev/next) ────────────────────────────────────────────
export function navigateCard(dir, ctx) {
  const seq = ctx === 'player' ? state.cardSequence : ctx === 'collection' ? state.collCardSequence : state.gradedCardSequence
  const idx = seq.indexOf(state.currentCardId)
  if (idx === -1) return
  const nextIdx = dir === 'next' ? idx + 1 : idx - 1
  if (nextIdx < 0 || nextIdx >= seq.length) return

  const nextId = seq[nextIdx]
  state.setCurrentCardId(nextId)
  state.setActiveCardContext(ctx)

  const useInline = ctx === 'player' ? isFoldLayout() : isWideLayout()
  if (useInline) {
    handleCardTap(nextId, ctx)
    return
  }

  // Animate the sheet panel
  const panelIds = { player: 'cardDetailPanel', collection: 'collectionCardPanel', graded: 'gradedCardPanel' }
  const panel = document.getElementById(panelIds[ctx])
  if (!panel) return
  const vw = window.innerWidth
  panel.style.transition = 'none'
  panel.style.transform = `translateX(${dir === 'next' ? -vw : vw}px)`
  renderCardPanelInto(panel, nextId, ctx)

  // Update row selection
  const rowSel = ctx === 'graded' ? '.graded-tile' : '.card-item'
  document.querySelectorAll(`${rowSel}.tp-selected`).forEach(el => el.classList.remove('tp-selected'))
  const rowEl = document.querySelector(`${rowSel}[data-card-id="${nextId}"]`)
  if (rowEl) rowEl.classList.add('tp-selected')

  requestAnimationFrame(() => {
    panel.classList.add('animating')
    panel.style.transform = 'translateX(0)'
    setTimeout(() => panel.classList.remove('animating'), 320)
  })
}

// ── Close a single card sheet ──────────────────────────────────────────────
export function closeCardSheet(ctx) {
  const ids = { player: 'cardDetailSheet', collection: 'collectionCardSheet', graded: 'gradedCardSheet' }
  const sheet = document.getElementById(ids[ctx])
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.classList.remove('open')
  sheet.style.transform = ''

  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'none'
  const nb   = document.getElementById('nav-bar')
  const ffab = document.getElementById('floating-fab')
  if (nb)   { nb.style.transition = 'transform 0.35s cubic-bezier(0.05,0.7,0.1,1)'; nb.style.transform = 'translateX(-50%) translateY(0)' }
  if (history.state?.v === 'card') history.back()
}
