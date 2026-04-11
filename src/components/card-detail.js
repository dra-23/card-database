import { db, doc, setDoc, ref, uploadBytes, getDownloadURL, storage } from '../firebase.js'
import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr, sheetTransformY, vibrate } from '../utils.js'
import { isWideLayout, isThreePaneLayout } from '../layout.js'
import { closeCardSheets } from '../gestures.js'

// ── Card detail HTML ───────────────────────────────────────────────────────
export function buildCardDetailHTML(card, ctx) {
  const player    = state.ALL_PLAYERS.find(p => p.id === card.Player)
  const playerName = player ? (player.Player || player.id) : (card.Player || '')
  const co        = card['Grading Company'] || ''
  const gr        = card.Grade || ''
  const gradeStr  = (co && co !== 'Raw') ? `${co} ${gr}` : ''
  const owned     = isOwned(card)
  const url       = card['Card Information'] || ''

  return `
    <div class="card-detail-image-wrap">
      <img src="${getCleanImg(card['App Image'])}" alt="${escapeAttr(card.Set)}" style="max-height:380px; width:100%; object-fit:contain; background:var(--md-surface-1);">
    </div>
    <div class="card-detail-body">
      <div>
        <div class="card-detail-title">${card.Year || ''} ${card.Set || ''}</div>
        <div class="card-detail-sub">${playerName} · #${card.Number || 'N/A'}</div>
        ${gradeStr ? `<div style="margin-top:8px;"><span class="badge-grade" style="font-size:13px; padding:5px 12px;">${gradeStr}</span></div>` : ''}
      </div>
      <div class="card-detail-stat-row">
        <div class="card-detail-stat">
          <div class="card-detail-stat-label">Manufacturer</div>
          <div class="card-detail-stat-val">${card.Manufacturer || '—'}</div>
        </div>
        <div class="card-detail-stat">
          <div class="card-detail-stat-label">Sport</div>
          <div class="card-detail-stat-val">${card.Sport || '—'}</div>
        </div>
        <div class="card-detail-stat">
          <div class="card-detail-stat-label">Team</div>
          <div class="card-detail-stat-val">${card.Team || '—'}</div>
        </div>
        <div class="card-detail-stat">
          <div class="card-detail-stat-label">Price Paid</div>
          <div class="card-detail-stat-val">${card.Price ? '$' + card.Price : '—'}</div>
        </div>
      </div>
      ${(card.RC === true || card.RC === 'true') ? `<div><span class="badge-rc" style="font-size:12px; padding:4px 12px;">ROOKIE CARD</span></div>` : ''}
      ${(card.Auto === true || card.Auto === 'true') ? `<div><span class="badge-auto" style="font-size:12px; padding:4px 12px;">AUTOGRAPH</span></div>` : ''}
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--md-surface-2); border-radius:16px; padding:14px 16px;">
        <span style="font-size:15px; font-weight:700;">${owned ? 'In collection' : 'On wishlist'}</span>
        <button class="status-toggle-btn ${owned ? 'sleevd' : ''}" data-card-toggle="${escapeAttr(card.id)}"></button>
      </div>
      <div class="button-row-split">
        <button class="expressive-btn" data-card-edit="${escapeAttr(card.id)}" style="background:var(--md-surface-2); box-shadow:none; color:var(--md-on-surface); height:52px; border-radius:24px;">Edit</button>
        ${url ? `<a href="${url}" target="_blank" rel="noopener" style="flex:1;"><button class="expressive-btn" style="background:var(--md-surface-1); box-shadow:none; height:52px; border-radius:24px; width:100%;">Info ↗</button></a>` : ''}
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

  // Edit button
  panelEl.querySelector(`[data-card-edit]`)?.addEventListener('click', () => {
    window._openCardForm?.(cardId)
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
    const ffab   = document.getElementById('floating-fab')
    if (scrim) scrim.style.display = 'block'
    if (nb)    { nb.style.transform = 'translateX(-50%) translateY(calc(100% + 32px))'; nb.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)' }
    if (ffab)  { ffab.style.transform = 'translateY(calc(100% + 32px))'; ffab.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)' }

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
  if (ffab) { ffab.style.transition = 'transform 0.35s cubic-bezier(0.05,0.7,0.1,1)'; ffab.style.transform = 'translateY(0)' }
  if (history.state?.v === 'card') history.back()
}
