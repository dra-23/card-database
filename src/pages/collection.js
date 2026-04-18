import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr } from '../utils.js'

export function renderCollectionView() {
  if (!state.cardsLoaded) return

  // 1. Filter
  let cards = state.collShowWishlistOnly
    ? state.ALL_CARDS.filter(c => !isOwned(c))
    : [...state.ALL_CARDS]

  if (state.collShowGradedOnly) {
    cards = cards.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')
  }

  if (state.collSearchQuery) {
    const q = state.collSearchQuery.toLowerCase()
    cards = cards.filter(c =>
      (c.Year || '').toString().toLowerCase().includes(q) ||
      (c.Set || '').toLowerCase().includes(q) ||
      (c.Manufacturer || '').toLowerCase().includes(q) ||
      (c.Player || '').toLowerCase().includes(q)
    )
  }

  // 2. Sort — primary key determined by chip, sub-order always: year → sport → set → number
  const sortBy = state.collSortBy || 'year'

  const subSort = (a, b) => {
    const yA = parseInt(a.Year) || 0, yB = parseInt(b.Year) || 0
    if (yA !== yB) return yA - yB
    const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
    if (setA !== setB) return setA.localeCompare(setB)
    const spA = (a.Sport || '').toLowerCase(), spB = (b.Sport || '').toLowerCase()
    if (spA !== spB) return spA.localeCompare(spB)
    return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
  }

  if (sortBy === 'sport') {
    cards.sort((a, b) => {
      const sA = (a.Sport || '').toLowerCase(), sB = (b.Sport || '').toLowerCase()
      if (sA !== sB) return sA.localeCompare(sB)
      return subSort(a, b)
    })
  } else if (sortBy === 'set') {
    cards.sort((a, b) => {
      const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
      if (setA !== setB) return setA.localeCompare(setB)
      return subSort(a, b)
    })
  } else {
    cards.sort(subSort)
  }

  const counterEl = document.getElementById('collectionOwnedCounter')
  if (counterEl) counterEl.innerText = cards.length

  state.setCollCardSequence(cards.map(c => c.id))

  const container = document.getElementById('collectionList')
  if (!container) return
  container.innerHTML = ''

  // 3. Group by sort mode
  const groups = new Map()
  cards.forEach(c => {
    let key
    if (sortBy === 'sport') key = c.Sport || '(Unknown Sport)'
    else if (sortBy === 'set') key = c.Set || '(Unknown Set)'
    else key = c.Year?.toString() || 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  })

  if (groups.size === 0) {
    container.innerHTML = `<div style="padding:48px 24px; text-align:center; opacity:0.4;"><div style="font-size:40px; margin-bottom:12px;">📦</div><div style="font-weight:700;">No cards found</div></div>`
    return
  }

  const groupKeys = Array.from(groups.keys())
  let currentGroupIdx = 0

  // 4. Virtualized rendering — load groups on demand as user scrolls
  function renderNextGroup() {
    if (currentGroupIdx >= groupKeys.length) return

    const key = groupKeys[currentGroupIdx]
    const groupCards = groups.get(key)
    const fragment = document.createDocumentFragment()

    const header = document.createElement('div')
    header.className = 'year-group-header'
    header.innerHTML = `${key} <span class="year-count">${groupCards.length} cards</span>`
    fragment.appendChild(header)

    const listDiv = document.createElement('div')
    listDiv.className = 'collection-card-list'
    groupCards.forEach(card => {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = buildCollectionRow(card)
      listDiv.appendChild(wrapper.firstElementChild)
    })
    fragment.appendChild(listDiv)

    const oldSentinel = document.getElementById('collection-sentinel')
    if (oldSentinel) oldSentinel.remove()

    container.appendChild(fragment)
    currentGroupIdx++

    if (currentGroupIdx < groupKeys.length) createSentinel()
  }

  function createSentinel() {
    const sentinel = document.createElement('div')
    sentinel.id = 'collection-sentinel'
    sentinel.style.cssText = 'height: 100px; width: 100%;'
    container.appendChild(sentinel)

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect()
        renderNextGroup()
      }
    }, {
      root: document.getElementById('collectionScrollBody'),
      rootMargin: '800px',
    })

    observer.observe(sentinel)
  }

  renderNextGroup()
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
  const gradeBadge    = (co && co !== 'Raw') ? `<span class="badge-grade" data-co="${co}">${co} ${gr}</span>` : ''
  const rcBadge       = isRC       ? `<span class="badge-rc">RC</span>`         : ''
  const autoBadge     = isAuto     ? `<span class="badge-auto">AUTO</span>`     : ''
  const memBadge      = isMem      ? `<span class="badge-mem">MEM</span>`       : ''
  const numberedBadge = isNumbered ? `<span class="badge-numbered">#'d</span>` : ''
  const hasBadges     = gradeBadge || rcBadge || autoBadge || memBadge || numberedBadge

  return `<div class="card-item ${!owned ? 'not-owned' : ''}" data-card-id="${escapeAttr(c.id)}">
    <img class="card-thumb" src="${getCleanImg(c['App Image'])}" alt="" loading="lazy" decoding="async">
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
