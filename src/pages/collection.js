import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr, imgPh, emptyStateHTML, clearLabel } from '../utils.js'
import { savedMarketValue } from '../services/market-value.js'

export function renderCollectionView({ preserveScroll = false } = {}) {
  if (!state.cardsLoaded) return

  const scrollEl = document.getElementById('collectionScrollBody')
  const savedScroll = preserveScroll ? (scrollEl?.scrollTop ?? 0) : 0

  // 1. Filter
  let cards = state.collShowWishlistOnly
    ? state.ALL_CARDS.filter(c => !isOwned(c))
    : [...state.ALL_CARDS]

  if (state.collShowGradedOnly) {
    cards = cards.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')
  }
  if (state.collShowFavoriteOnly) cards = cards.filter(c => c.Favorite === true || c.Favorite === 'true')
  if (state.collFilterRC)       cards = cards.filter(c => c.RC       === true || c.RC       === 'true')
  if (state.collFilterAuto)     cards = cards.filter(c => c.Auto     === true || c.Auto     === 'true')
  if (state.collFilterMem)      cards = cards.filter(c => c.Mem      === true || c.Mem      === 'true' || c.Patch === true || c.Patch === 'true')
  if (state.collFilterNumbered) cards = cards.filter(c => c.Numbered === true || c.Numbered === 'true')

  if (state.collSearchQuery) {
    const tokens = state.collSearchQuery.toLowerCase().trim().split(/\s+/)
    cards = cards.filter(c => {
      const haystack = [
        (c.Year || '').toString(),
        c.Set || '',
        c.Manufacturer || '',
        c.Player || '',
      ].join(' ').toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
  }

  // 2. Sort — primary key determined by chip, sub-order always: year → set → number
  const sortBy = state.collSortBy || 'year'

  const subSort = (a, b) => {
    const yA = parseInt(a.Year) || 0, yB = parseInt(b.Year) || 0
    if (yA !== yB) return yA - yB
    const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
    if (setA !== setB) return setA.localeCompare(setB)
    const spA = (a.Sport || '').toLowerCase(), spB = (b.Sport || '').toLowerCase()
    if (spA !== spB) return spA.localeCompare(spB)
    return String(a.Number ?? '').localeCompare(String(b.Number ?? ''), undefined, { numeric: true })
  }

  // Value / Gain-Loss use market values saved on each card (no API calls);
  // cards without one sort after, in normal year order
  const gainOf = c => {
    const mv = savedMarketValue(c), paid = parseFloat(c.Price)
    return mv != null && paid > 0 ? mv - paid : null
  }
  const paidOf = c => { const p = parseFloat(c.Price); return p > 0 ? p : null }
  const byMetric = metric => (a, b) => {
    const mA = metric(a), mB = metric(b)
    if (mA != null && mB != null && mA !== mB) return mB - mA
    if ((mA == null) !== (mB == null)) return mA == null ? 1 : -1
    return subSort(a, b)
  }

  if (sortBy === 'value') {
    cards.sort(byMetric(savedMarketValue))
  } else if (sortBy === 'gain') {
    cards.sort(byMetric(gainOf))
  } else if (sortBy === 'paid') {
    cards.sort(byMetric(paidOf))
  } else if (sortBy === 'sport') {
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
    if (sortBy === 'value') {
      const mv = savedMarketValue(c)
      key = mv == null ? 'No value yet' : (VALUE_BANDS.find(([min]) => mv >= min) || VALUE_BANDS[VALUE_BANDS.length - 1])[1]
    } else if (sortBy === 'gain') {
      const g = gainOf(c)
      key = g == null ? 'No value or purchase price' : g >= 0 ? 'Gaining' : 'Losing'
    } else if (sortBy === 'paid') {
      const p = paidOf(c)
      key = p == null ? 'No purchase price' : (VALUE_BANDS.find(([min]) => p >= min) || VALUE_BANDS[VALUE_BANDS.length - 1])[1]
    } else if (sortBy === 'sport') key = c.Sport || '(Unknown Sport)'
    else if (sortBy === 'set') key = c.Set || '(Unknown Set)'
    else key = c.Year?.toString() || 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  })

  if (groups.size === 0) {
    const hasFilters = state.collShowWishlistOnly || state.collShowGradedOnly || state.collShowFavoriteOnly ||
      state.collFilterRC || state.collFilterAuto || state.collFilterMem || state.collFilterNumbered
    const hasSearch = !!state.collSearchQuery
    container.innerHTML = hasFilters || hasSearch
      ? emptyStateHTML({ icon: 'filter_alt_off', title: 'No cards match', body: `Nothing in your collection matches ${hasFilters && hasSearch ? 'these filters and search' : hasFilters ? 'these filters' : 'this search'}.`, action: { scope: 'collection', label: clearLabel(hasFilters, hasSearch) } })
      : emptyStateHTML({ icon: 'inventory_2', title: 'No cards yet', body: 'Add your first card with the + button.' })
    return
  }
  // Money sorts keep their high-to-low order and show the amount on each row
  const rowMoney = sortBy === 'value' || sortBy === 'gain' ? 'value' : sortBy === 'paid' ? 'paid' : null
  const showValue = !!rowMoney

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
    header.innerHTML = `<span class="year-group-key">${key}</span><span class="year-count">${groupCards.length} card${groupCards.length !== 1 ? 's' : ''}</span>`
    fragment.appendChild(header)

    if (sortBy !== 'year' && !showValue) {
      // Sub-group by year within each primary group (value sorts keep their
      // high-to-low order instead)
      const yearGroups = new Map()
      groupCards.forEach(c => {
        const yr = c.Year?.toString() || 'Unknown'
        if (!yearGroups.has(yr)) yearGroups.set(yr, [])
        yearGroups.get(yr).push(c)
      })
      const showSubs = yearGroups.size > 1
      yearGroups.forEach((yearCards, yr) => {
        if (showSubs) {
          const subHeader = document.createElement('div')
          subHeader.className = 'year-sub-header'
          subHeader.textContent = yr
          fragment.appendChild(subHeader)
        }
        const listDiv = document.createElement('div')
        listDiv.className = 'collection-card-list'
        yearCards.forEach(card => {
          const wrapper = document.createElement('div')
          wrapper.innerHTML = buildCollectionRow(card)
          listDiv.appendChild(wrapper.firstElementChild)
        })
        fragment.appendChild(listDiv)
      })
    } else {
      const listDiv = document.createElement('div')
      listDiv.className = 'collection-card-list'
      groupCards.forEach(card => {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = buildCollectionRow(card, rowMoney)
        listDiv.appendChild(wrapper.firstElementChild)
      })
      fragment.appendChild(listDiv)
    }

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

  if (preserveScroll && savedScroll > 0) {
    // Render all groups synchronously so content is tall enough for scroll restore
    while (currentGroupIdx < groupKeys.length) renderNextGroup()
    requestAnimationFrame(() => { if (scrollEl) scrollEl.scrollTop = savedScroll })
  } else {
    renderNextGroup()
  }
}

const VALUE_BANDS = [[1000, '$1,000+'], [250, '$250 – $999'], [100, '$100 – $249'], [25, '$25 – $99'], [-Infinity, 'Under $25']]
const money = n => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Market value (and gain/loss vs. paid) under the row, for the value sorts
function valueLine(c) {
  const mv = savedMarketValue(c)
  if (mv == null) return ''
  const paid = parseFloat(c.Price)
  const gain = paid > 0 ? mv - paid : null
  const g = gain == null ? '' : ` <span class="card-row-gain ${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? '+' : '−'}${money(Math.abs(gain))}</span>`
  return `<div class="card-row-value">${money(mv)}${g}</div>`
}

// Purchase price under the row (and current value if one's saved), for the
// Price paid sort
function paidLine(c) {
  const paid = parseFloat(c.Price)
  if (!(paid > 0)) return ''
  const mv = savedMarketValue(c)
  return `<div class="card-row-value">Paid ${money(paid)}${mv != null ? ` <span class="card-row-worth">· worth ${money(mv)}</span>` : ''}</div>`
}

function buildCollectionRow(c, rowMoney = null) {
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
    <img class="card-thumb" src="${getCleanImg(c['App Image'])}" alt="" loading="lazy" decoding="async" ${imgPh(c)}>
    <div class="card-info">
      <div class="card-info-row1">${c.Set || ''} #${c.Number || 'N/A'}</div>
      <div class="card-info-row2">${playerName}</div>
      ${hasBadges ? `<div class="card-badge-tray">${gradeBadge}${rcBadge}${autoBadge}${memBadge}${numberedBadge}</div>` : ''}
      ${rowMoney === 'value' ? valueLine(c) : rowMoney === 'paid' ? paidLine(c) : ''}
    </div>
    <button class="card-row-menu-btn" data-menu-card="${escapeAttr(c.id)}" aria-label="Card options">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
  </div>`
}
