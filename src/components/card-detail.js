import { db, doc, setDoc, ref, uploadBytes, getDownloadURL, storage } from '../firebase.js'
import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr, sheetTransformY, vibrate } from '../utils.js'
import { isWideLayout, isThreePaneLayout } from '../layout.js'
import { closeCardSheets } from '../gestures.js'

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
  const serial      = card.Serial || card['Serial Number'] || ''
  const notes       = card.Notes || ''
  const isRC        = card.RC       === true || card.RC       === 'true'
  const isAuto      = card.Auto     === true || card.Auto     === 'true'
  const isMem       = card.Mem === true || card.Mem === 'true' || card.Patch === true || card.Patch === 'true'
  const isNumbered  = card.Numbered === true || card.Numbered === 'true'
  const ebayQ       = encodeURIComponent([card.Year, card.Set, playerName, card.Number ? `#${card.Number}` : '', parallel].filter(Boolean).join(' ').trim())
  const ebayUrl     = `https://www.ebay.com/sch/i.html?_nkw=${ebayQ}&LH_Sold=1&LH_Complete=1`
  const tcdbUrl     = url  // Card Information field IS the TCDB link

  const stats = [
    ['Manufacturer', card.Manufacturer],
    ['Sport',        card.Sport],
    ['Team',         card.Team],
    ['Price Paid',   card.Price ? `$${card.Price}` : null],
    ...(parallel ? [['Parallel', parallel]] : []),
    ...(serial   ? [['Serial',   serial]]   : []),
  ]

  return `
    <div class="cd-img-wrap">
      <img src="${getCleanImg(card['App Image'])}" alt="${escapeAttr(card.Set)}">
    </div>
    <div class="cd-body">
      <div class="cd-header">
        <div class="cd-header-info">
          <div class="cd-year-set">${card.Year || ''} ${card.Set || ''} #${card.Number || 'N/A'}</div>
          <div class="cd-player">${playerName}</div>
          <div class="cd-badge-row">
            ${gradeStr   ? `<span class="badge-grade">${gradeStr}</span>`   : ''}
            ${isRC       ? `<span class="badge-rc">ROOKIE</span>`           : ''}
            ${isAuto     ? `<span class="badge-auto">AUTO</span>`           : ''}
            ${isMem      ? `<span class="badge-mem">MEM</span>`             : ''}
            ${isNumbered ? `<span class="badge-numbered">#'d</span>`        : ''}
          </div>
        </div>
        <button class="cd-menu-btn" data-card-menu="${escapeAttr(card.id)}" aria-label="Card options">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </div>
      <div class="cd-divider"></div>
      <div class="cd-stats-grid">
        ${stats.map(([lbl, val]) => `
          <div class="cd-stat">
            <div class="cd-stat-lbl">${lbl}</div>
            <div class="cd-stat-val">${val || '—'}</div>
          </div>`).join('')}
      </div>
      ${notes ? `<div class="cd-notes">${notes}</div>` : ''}
      <div class="cd-owned-row">
        <span class="cd-owned-label">${owned ? 'sleevd' : 'unsleevd'}</span>
        <button class="status-toggle-btn ${owned ? 'sleevd' : ''}" data-card-toggle="${escapeAttr(card.id)}"></button>
      </div>
      <div class="cd-action-row">
        <a href="${ebayUrl}" target="_blank" rel="noopener" class="cd-ext-link">
          <button class="cd-ext-btn cd-btn-ebay">eBay Sold ↗</button>
        </a>
        ${tcdbUrl ? `<a href="${tcdbUrl}" target="_blank" rel="noopener" class="cd-ext-link">
          <button class="cd-ext-btn cd-btn-tcdb">TCDB ↗</button>
        </a>` : ''}
      </div>
    </div>
  `
}

// ── Render card into a panel element ──────────────────────────────────────
export function renderCardPanelInto(panelEl, cardId, ctx) {
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return
  panelEl.innerHTML = buildCardDetailHTML(card, ctx)

  // Toggle owned
  panelEl.querySelector(`[data-card-toggle]`)?.addEventListener('click', async () => {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    await setDoc(doc(db, 'Cards', cardId), { Owned: !isOwned(c) }, { merge: true })
  })

  // 3-dot menu
  panelEl.querySelector(`[data-card-menu]`)?.addEventListener('click', e => {
    window._openRowMenu?.(cardId, e.currentTarget)
  })
}

export function refreshCurrentCardPanel(cardId) {
  if (!cardId || cardId !== state.currentCardId) return
  const ctx = state.activeCardContext

  if (ctx === 'player') {
    const panel = isThreePaneLayout()
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
export function handleCardTap(cardId, ctx) {
  state.setCurrentCardId(cardId)
  state.setActiveCardContext(ctx || 'player')

  const useInlinePanel = ctx === 'player' ? isThreePaneLayout() : isWideLayout()

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
    if (panel)   { panel.style.display = 'block'; panel.classList.remove('animating'); panel.style.transform = ''; renderCardPanelInto(panel, cardId, ctx) }
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
    if (nb)    { nb.style.transform = 'translateX(-50%) translateY(calc(100% + 32px))'; nb.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)' }

    history.pushState({ v: 'card', id: cardId, ctx }, '')
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

  const useInline = ctx === 'player' ? isThreePaneLayout() : isWideLayout()
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
