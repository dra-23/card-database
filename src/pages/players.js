import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr, SPORT_ICONS } from '../utils.js'
import { isWideLayout, _applyWideLayout, _updateFloatingFab } from '../layout.js'
import { handleCardTap } from '../components/card-detail.js'

export function renderGallery() {
  const grid = document.getElementById('playerGrid')
  if (!grid) return

  const sorted = [...state.ALL_PLAYERS].sort((a, b) => {
    const oa = state.ALL_CARDS.filter(c => c.Player === a.id && isOwned(c)).length
    const ob = state.ALL_CARDS.filter(c => c.Player === b.id && isOwned(c)).length
    return (ob - oa) || a.id.localeCompare(b.id)
  })

  grid.innerHTML = sorted.map(p => {
    const pC    = state.ALL_CARDS.filter(c => c.Player === p.id)
    const icons = [...new Set(pC.map(c => c.Sport).filter(Boolean))]
      .map(s => `<div class="sport-icon">${SPORT_ICONS[s] || '🏐'}</div>`).join('')
    return `
      <div class="player-tile" data-player-id="${escapeAttr(p.id)}">
        <div class="sport-badge-overlay">${icons}</div>
        <img class="tile-img" src="${getCleanImg(p['Main Image'])}" alt="${escapeAttr(p.Player || p.id)}">
        <div class="tile-text-bar">
          <div class="tile-title">${p.Player || p.id}</div>
          <div class="tile-subtitle">${pC.filter(c => isOwned(c)).length} owned</div>
        </div>
      </div>`
  }).join('')

  // Attach click + long-press on tiles
  grid.querySelectorAll('.player-tile').forEach(tile => {
    tile.addEventListener('click', () => openDetail(tile.dataset.playerId))
    tile.addEventListener('contextmenu', e => { e.preventDefault(); window._openPlayerEditMenu?.(tile.dataset.playerId) })
    let pressTimer = null
    tile.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => { pressTimer = null; window._openPlayerEditMenu?.(tile.dataset.playerId) }, 500)
    }, { passive: true })
    tile.addEventListener('touchend',   () => { clearTimeout(pressTimer); pressTimer = null })
    tile.addEventListener('touchmove',  () => { clearTimeout(pressTimer); pressTimer = null })
  })
}

// ── Player detail ───────────────────────────────────────────────────────────
export function openDetail(id) {
  const player = state.ALL_PLAYERS.find(p => p.id === id)
  if (!player) return
  state.setSelectedPlayer(player)

  document.getElementById('playerName').innerText    = player.Player || player.id
  document.getElementById('playerBanner').src        = getCleanImg(player['Banner_Image'])
  document.getElementById('playerThumb').src         = getCleanImg(player['Main Image'])

  // Populate wide-layout hero stats
  const allPlayerCards = state.ALL_CARDS.filter(c => c.Player === player.id)
  const heroSleevd    = allPlayerCards.filter(c => isOwned(c)).length
  const heroUnsleevd  = allPlayerCards.filter(c => !isOwned(c)).length
  const heroGraded    = allPlayerCards.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw').length
  const heroName = document.getElementById('playerWideHeroName')
  if (heroName) heroName.textContent = player.Player || player.id
  const heroS = document.getElementById('wideHeroSleevd')
  const heroU = document.getElementById('wideHeroUnsleevd')
  const heroG = document.getElementById('wideHeroGraded')
  if (heroS) heroS.textContent = heroSleevd
  if (heroU) heroU.textContent = heroUnsleevd
  if (heroG) heroG.textContent = heroGraded
  state.setCardSearchQuery('')
  document.getElementById('cardSearchInput').value   = ''
  const detailWrap = document.getElementById('detailHeaderWrap')
  if (detailWrap) detailWrap.classList.remove('collapsed')

  if (isWideLayout()) {
    state.setCurrentCardId(null)
    const dv    = document.getElementById('detail-view')
    const slot  = document.getElementById('slot-players')
    const gv    = document.getElementById('gallery-view')
    if (dv.parentElement !== slot) slot.appendChild(dv)
    slot.style.display = 'flex'; slot.style.flexDirection = 'row'
    gv.style.width = '300px'; gv.style.minWidth = '300px'; gv.style.maxWidth = '300px'
    gv.style.flexShrink = '0'; gv.style.borderRight = '1px solid var(--md-surface-2)'
    dv.style.display = 'flex'; dv.style.flexDirection = 'row'
    dv.style.flex = '1'; dv.style.minWidth = '0'
    dv.style.position = 'relative'; dv.style.inset = ''
    dv.classList.remove('tp-no-player')
    document.getElementById('twoPane-empty').style.display = 'flex'
    document.getElementById('twoPane-panel').style.display = 'none'
    document.getElementById('twoPane-panel').innerHTML = ''
    document.querySelectorAll('.card-item.tp-selected').forEach(el => el.classList.remove('tp-selected'))
  }

  // Highlight selected player tile in gallery
  document.querySelectorAll('.player-tile').forEach(t => t.classList.remove('tile-selected'))
  document.querySelector(`.player-tile[data-player-id="${player.id}"]`)?.classList.add('tile-selected')

  renderDetail(player)

  if (!isWideLayout()) {
    const dv = document.getElementById('detail-view')
    dv.style.display = 'flex'; dv.style.flexDirection = 'column'
    _updateFloatingFab('players')
    history.pushState({ v: 'detail', p: id }, '')
  }
}

export function closeDetail() {
  const dv   = document.getElementById('detail-view')
  const gv   = document.getElementById('gallery-view')
  const slot = document.getElementById('slot-players')
  dv.style.display = 'none'; dv.style.flex = ''; dv.style.minWidth = ''
  dv.style.position = 'absolute'; dv.style.inset = '0'
  dv.style.transform = ''; dv.style.transition = ''
  dv.classList.add('tp-no-player')
  state.setSelectedPlayer(null)
  document.querySelectorAll('.player-tile').forEach(t => t.classList.remove('tile-selected'))
  if (!isWideLayout()) {
    _updateFloatingFab('players')
    if (history.state?.v === 'detail') history.back()
  } else {
    gv.style.width = ''; gv.style.minWidth = ''; gv.style.maxWidth = ''
    gv.style.flexShrink = ''; gv.style.borderRight = ''
    slot.style.display = ''; slot.style.flexDirection = ''
  }
}

// ── Swipe-right-to-go-back gesture on mobile detail view ──────────────────
export function initDetailSwipeBack() {
  const dv = document.getElementById('detail-view')
  if (!dv) return

  let sx = 0, sy = 0, lx = 0, active = false, locked = null

  dv.addEventListener('touchstart', e => {
    if (isWideLayout() || !state.selectedPlayer) return
    const t = e.touches[0]
    sx = t.clientX; sy = t.clientY; lx = sx
    active = true; locked = null
  }, { passive: true })

  dv.addEventListener('touchmove', e => {
    if (!active || isWideLayout()) return
    const t = e.touches[0]
    lx = t.clientX
    const dx = t.clientX - sx, dy = t.clientY - sy
    if (!locked) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) locked = 'h'
      else if (Math.abs(dy) > 8) { locked = 'v'; active = false; return }
      else return
    }
    if (locked === 'h' && dx > 0) {
      if (e.cancelable) e.preventDefault()
      dv.style.transform = `translateX(${dx}px)`
    }
  }, { passive: false })

  function onEnd() {
    if (!active) return
    active = false
    const dx = lx - sx
    if (locked === 'h' && dx > window.innerWidth * 0.3) {
      dv.style.transition = 'transform 0.25s ease'
      dv.style.transform  = `translateX(${window.innerWidth}px)`
      setTimeout(() => closeDetail(), 230)
    } else {
      dv.style.transition = 'transform 0.25s ease'
      dv.style.transform  = 'translateX(0)'
      setTimeout(() => { dv.style.transition = ''; dv.style.transform = '' }, 250)
    }
    locked = null
  }

  dv.addEventListener('touchend',    onEnd, { passive: true })
  dv.addEventListener('touchcancel', onEnd, { passive: true })
}

export function renderDetail(player) {
  if (!player) return
  let cards = state.ALL_CARDS.filter(c => c.Player === player.id)
    .sort((a, b) => {
      const yA = a.Year?.toString() || '', yB = b.Year?.toString() || ''
      if (yA !== yB) return yA.localeCompare(yB)
      const sA = (a.Set || '').toLowerCase(), sB = (b.Set || '').toLowerCase()
      if (sA !== sB) return sA.localeCompare(sB)
      return (parseInt(a.Number) || 0) - (parseInt(b.Number) || 0)
    })

  if (state.cardSearchQuery) {
    const q = state.cardSearchQuery.toLowerCase()
    cards = cards.filter(c => (c.Year || '').toString().toLowerCase().includes(q) || (c.Set || '').toLowerCase().includes(q))
  }
  if (state.showGradedOnly)   cards = cards.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')
  if (state.showWishlistOnly) cards = cards.filter(c => !isOwned(c))

  state.setCardSequence(cards.map(c => c.id))
  document.getElementById('playerDetailCount').innerText =
    `${cards.filter(c => isOwned(c)).length} Owned`

  const groups = new Map()
  cards.forEach(c => {
    const key = c.Year?.toString() || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  })

  let html = ''
  groups.forEach((groupCards, yearKey) => {
    const rawYears   = [...new Set(groupCards.map(c => (c.Year || '').toString()))].sort()
    const displayYear = rawYears.length === 1 ? rawYears[0] : rawYears.join(' · ')
    html += `<div class="year-group-header">${displayYear}<span class="year-count">${groupCards.filter(c => isOwned(c)).length} owned</span></div><div class="collection-card-list">`
    groupCards.forEach(c => { html += buildCardRow(c, 'player') })
    html += '</div>'
  })

  if (!html) html = `<div style="padding:48px 24px; text-align:center; opacity:0.4;"><div style="font-size:40px; margin-bottom:12px;">🃏</div><div style="font-weight:700;">No cards found</div></div>`
  document.getElementById('cardList').innerHTML = html
}

export function buildCardRow(c, ctx) {
  const owned     = isOwned(c)
  const co        = c['Grading Company'] || '', gr = c.Grade || ''
  const isRC       = c.RC       === true || c.RC       === 'true'
  const isAuto     = c.Auto     === true || c.Auto     === 'true'
  const isMem      = c.Mem === true || c.Mem === 'true' || c.Patch === true || c.Patch === 'true'
  const isNumbered = c.Numbered === true || c.Numbered === 'true'
  const gradeBadge    = (co && co !== 'Raw') ? `<span class="badge-grade" data-co="${co}">${co} ${gr}</span>` : ''
  const rcBadge       = isRC       ? `<span class="badge-rc">RC</span>`         : ''
  const autoBadge     = isAuto     ? `<span class="badge-auto">AUTO</span>`     : ''
  const memBadge      = isMem      ? `<span class="badge-mem">MEM</span>`       : ''
  const numberedBadge = isNumbered ? `<span class="badge-numbered">#'d</span>` : ''
  const hasBadges     = gradeBadge || rcBadge || autoBadge || memBadge || numberedBadge

  return `<div class="card-item ${!owned ? 'not-owned' : ''}" data-card-id="${escapeAttr(c.id)}">
    <img class="card-thumb" src="${getCleanImg(c['App Image'])}" alt="">
    <div class="card-info">
      <div class="card-info-row1">${c.Year} ${c.Set || ''}</div>
      <div class="card-info-row2">#${c.Number || 'N/A'}</div>
      ${hasBadges ? `<div class="card-badge-tray">${gradeBadge}${rcBadge}${autoBadge}${memBadge}${numberedBadge}</div>` : ''}
    </div>
    <button class="card-row-menu-btn" data-menu-card="${escapeAttr(c.id)}" aria-label="Card options">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
  </div>`
}

// ── Wire up card row clicks via event delegation ───────────────────────────
export function initCardListDelegation() {
  ;['cardList', 'collectionList', 'gradedList'].forEach(listId => {
    const list = document.getElementById(listId)
    if (!list) return
    list.addEventListener('click', e => {
      // 3-dot menu
      const menuBtn = e.target.closest('[data-menu-card]')
      if (menuBtn) { e.stopPropagation(); window._openRowMenu?.(menuBtn.dataset.menuCard, menuBtn); return }
      // Card tap
      const row = e.target.closest('[data-card-id]')
      if (row) {
        const ctx = listId === 'cardList' ? 'player' : listId === 'collectionList' ? 'collection' : 'graded'
        handleCardTap(row.dataset.cardId, ctx)
      }
    })
  })
}
