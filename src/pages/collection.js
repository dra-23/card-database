import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr } from '../utils.js'

export function renderCollectionView() {
  if (!state.cardsLoaded) return

  let cards = state.collShowWishlistOnly
    ? state.ALL_CARDS.filter(c => !isOwned(c))
    : state.ALL_CARDS.filter(c => isOwned(c))

  if (state.collShowGradedOnly) cards = cards.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')

  if (state.collSearchQuery) {
    const q = state.collSearchQuery.toLowerCase()
    cards = cards.filter(c =>
      (c.Year || '').toString().toLowerCase().includes(q) ||
      (c.Set || '').toLowerCase().includes(q) ||
      (c.Manufacturer || '').toLowerCase().includes(q) ||
      (c.Player || '').toLowerCase().includes(q)
    )
  }

  const sortBy = state.collSortBy || 'year'

  if (sortBy === 'sport') {
    cards.sort((a, b) => {
      const sA = (a.Sport || '').toLowerCase(), sB = (b.Sport || '').toLowerCase()
      if (sA !== sB) return sA.localeCompare(sB)
      const yA = a.Year?.toString() || '', yB = b.Year?.toString() || ''
      if (yA !== yB) return yA.localeCompare(yB)
      const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
      if (setA !== setB) return setA.localeCompare(setB)
      return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
    })
  } else if (sortBy === 'set') {
    cards.sort((a, b) => {
      const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
      if (setA !== setB) return setA.localeCompare(setB)
      return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
    })
  } else if (sortBy === 'number') {
    cards.sort((a, b) => {
      return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
    })
  } else {
    // Default: year
    cards.sort((a, b) => {
      const yA = a.Year?.toString() || '', yB = b.Year?.toString() || ''
      if (yA !== yB) return yA.localeCompare(yB)
      const sA = (a.Set || '').toLowerCase(), sB = (b.Set || '').toLowerCase()
      if (sA !== sB) return sA.localeCompare(sB)
      return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
    })
  }

  const counterEl = document.getElementById('collectionOwnedCounter')
  if (counterEl) counterEl.innerText = cards.length

  state.setCollCardSequence(cards.map(c => c.id))

  // Build groups based on sort mode
  const groups = new Map()
  cards.forEach(c => {
    let key = ''
    if (sortBy === 'sport')  key = c.Sport || '(Unknown Sport)'
    else if (sortBy === 'set') key = c.Set || '(Unknown Set)'
    else if (sortBy === 'number') key = 'All Cards'
    else key = c.Year?.toString() || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  })

  let html = ''
  groups.forEach((groupCards, groupKey) => {
    const ownedInGroup = groupCards.filter(c => isOwned(c)).length
    html += `<div class="year-group-header">${groupKey}<span class="year-count">${ownedInGroup} cards</span></div><div class="collection-card-list">`
    groupCards.forEach(c => { html += buildCollectionRow(c) })
    html += '</div>'
  })

  if (!html) html = `<div style="padding:48px 24px; text-align:center; opacity:0.4;"><div style="font-size:40px; margin-bottom:12px;">📦</div><div style="font-weight:700;">No cards found</div></div>`
  document.getElementById('collectionList').innerHTML = html
}

function buildCollectionRow(c) {
  const owned       = isOwned(c)
  const player      = state.ALL_PLAYERS.find(p => p.id === c.Player)
  const playerName  = player ? (player.Player || player.id) : (c.Player || '')
  const co          = c['Grading Company'] || '', gr = c.Grade || ''
  const isRC        = c.RC       === true || c.RC       === 'true'
  const isAuto      = c.Auto     === true || c.Auto     === 'true'
  const isMem       = c.Mem === true || c.Mem === 'true' || c.Patch === true || c.Patch === 'true'
  const isNumbered  = c.Numbered === true || c.Numbered === 'true'
  const gradeBadge    = (co && co !== 'Raw') ? `<span class="badge-grade">${co} ${gr}</span>` : ''
  const rcBadge       = isRC       ? `<span class="badge-rc">RC</span>`         : ''
  const autoBadge     = isAuto     ? `<span class="badge-auto">AUTO</span>`     : ''
  const memBadge      = isMem      ? `<span class="badge-mem">MEM</span>`       : ''
  const numberedBadge = isNumbered ? `<span class="badge-numbered">#'d</span>` : ''
  const hasBadges     = gradeBadge || rcBadge || autoBadge || memBadge || numberedBadge

  return `<div class="card-item ${!owned ? 'not-owned' : ''}" data-card-id="${escapeAttr(c.id)}">
    <img class="card-thumb" src="${getCleanImg(c['App Image'])}" alt="">
    <div class="card-info">
      <div class="card-info-row1">${c.Set || ''} #${c.Number || 'N/A'}</div>
      <div class="card-info-row2">${playerName}</div>
      ${hasBadges ? `<div class="card-badge-tray">${gradeBadge}${rcBadge}${autoBadge}${memBadge}${numberedBadge}</div>` : ''}
    </div>
    <button class="card-row-menu-btn" data-menu-card="${escapeAttr(c.id)}" aria-label="Card options">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
  </div>`
}
