import { currentPage, setCurrentPage, selectedPlayer, emit } from './state.js'

export const PAGE_NAMES = ['players', 'collection', 'graded', 'stats']
const NAV_BTN_W = 52, NAV_GAP = 4, NAV_PAD = 8

export const _wideQuery      = window.matchMedia('(min-width: 768px)')
export const _threePaneQuery = window.matchMedia('(min-width: 1280px)')

export function isWideLayout()      { return _wideQuery.matches }
export function isThreePaneLayout() { return _threePaneQuery.matches }

// ── Adaptive layout ────────────────────────────────────────────────────────
export function _applyWideLayout() {
  const dv   = document.getElementById('detail-view')
  const slot = document.getElementById('slot-players')
  const gv   = document.getElementById('gallery-view')
  if (!dv || !slot || !gv) return

  if (dv.parentElement !== slot) slot.appendChild(dv)
  dv.style.position = ''; dv.style.inset = ''; dv.style.zIndex = ''

  if (selectedPlayer) {
    slot.style.display = 'flex'; slot.style.flexDirection = 'row'
    if (isThreePaneLayout()) {
      gv.style.display = ''
      gv.style.width = '340px'; gv.style.minWidth = '340px'; gv.style.maxWidth = '340px'
      gv.style.flexShrink = '0'; gv.style.borderRight = '1px solid var(--md-surface-2)'
    } else {
      gv.style.display = 'none'
    }
    dv.style.display = 'flex'; dv.style.flexDirection = 'row'
    dv.style.flex = '1'; dv.style.minWidth = '0'
    dv.classList.remove('tp-no-player')
  } else {
    gv.style.display = ''
    gv.style.width = ''; gv.style.minWidth = ''; gv.style.maxWidth = ''
    gv.style.flexShrink = ''; gv.style.borderRight = ''
    slot.style.display = ''; slot.style.flexDirection = ''
    dv.style.display = 'none'; dv.style.flex = ''; dv.style.minWidth = ''
    dv.classList.add('tp-no-player')
    const empty = document.getElementById('twoPane-empty')
    const panel = document.getElementById('twoPane-panel')
    if (empty) empty.style.display = 'flex'
    if (panel) panel.style.display = 'none'
  }

  _commitPageSwitch(currentPage || 'players', PAGE_NAMES.indexOf(currentPage || 'players'))
  _updateFloatingFab(currentPage || 'players')
}

export function _applyMobileLayout() {
  document.querySelectorAll('.sheet.open').forEach(s => {
    s.style.transition = 'none'
    s.classList.remove('open')
    s.style.transform = ''
  })

  const gv = document.getElementById('gallery-view')
  if (gv) {
    gv.style.width = ''; gv.style.minWidth = ''; gv.style.maxWidth = ''
    gv.style.flexShrink = ''; gv.style.borderRight = ''
  }

  const dv  = document.getElementById('detail-view')
  const pc  = document.getElementById('page-container')
  if (dv && pc && dv.parentElement !== pc) pc.appendChild(dv)

  const slot = document.getElementById('slot-players')
  if (slot) { slot.style.display = ''; slot.style.flexDirection = '' }

  if (dv) {
    dv.style.display = 'none'; dv.style.flex = ''; dv.style.minWidth = ''
    dv.style.position = 'absolute'; dv.style.inset = '0'; dv.style.zIndex = ''
  }

  const nb = document.getElementById('nav-bar')
  if (nb) { nb.style.transition = 'none'; nb.style.transform = 'translateX(-50%)' }
  const ffab = document.getElementById('floating-fab')
  if (ffab) { ffab.style.transition = 'none'; ffab.style.transform = '' }

  _pageSwipeInited = false
  initPageSwipe()
  requestAnimationFrame(() => {
    const track = document.getElementById('page-track')
    if (!track) return
    const vw = window.innerWidth
    const idx = PAGE_NAMES.indexOf(currentPage || 'players')
    track.style.transition = 'none'
    track.style.transform = `translateX(${-Math.max(0, idx) * vw}px)`
    setTimeout(() => { track.style.transition = '' }, 50)
  })
}

// ── Navigation ─────────────────────────────────────────────────────────────
export function switchPage(page) {
  const idx = PAGE_NAMES.indexOf(page)
  if (idx === -1) return
  setCurrentPage(page)
  _commitPageSwitch(page, idx)
  _updateNavActive(page)
  _updateFloatingFab(page)
}

export function _commitPageSwitch(page, idx) {
  if (isWideLayout()) {
    PAGE_NAMES.forEach((p, i) => {
      const slot = document.getElementById(`slot-${p}`)
      if (!slot) return
      slot.style.display = (i === idx) ? '' : 'none'
    })
    const topBarTitle = document.getElementById('topBarTitle')
    if (topBarTitle) {
      const titles = { players: 'Players', collection: 'Collection', graded: 'Graded', stats: 'Profile' }
      topBarTitle.textContent = titles[page] || 'Players'
    }
  } else {
    const track = document.getElementById('page-track')
    if (!track) return
    const vw = window.innerWidth
    track.style.transform = `translateX(${-idx * vw}px)`
  }
  if (window._snapIndicator) window._snapIndicator(idx)
}

export function _updateNavActive(page) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page)
  })
  document.querySelectorAll('.rail-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page)
  })
  const indicator = document.getElementById('nav-indicator')
  if (indicator) indicator.style.opacity = page === 'stats' ? '0' : '1'
}

export function _updateFloatingFab(page) {
  const fab = document.getElementById('floating-fab')
  const sep = document.getElementById('nav-fab-sep')
  if (!fab) return

  if (isWideLayout()) {
    fab.style.display = 'none'
    if (sep) sep.style.display = 'none'
    return
  }

  const show = page === 'players' || page === 'collection'

  if (show) {
    fab.classList.add('visible')
    fab.style.display = 'flex'
    if (sep) sep.style.display = 'block'
  } else {
    fab.classList.remove('visible')
    fab.style.display = 'none'
    if (sep) sep.style.display = 'none'
  }
}

// ── Page swipe (mobile) ────────────────────────────────────────────────────
let _pageSwipeInited = false

export function initPageSwipe() {
  if (isWideLayout()) {
    PAGE_NAMES.forEach(p => {
      const slot = document.getElementById(`slot-${p}`)
      if (slot) slot.style.display = (p === (currentPage || 'players')) ? '' : 'none'
    })
    return
  }

  if (_pageSwipeInited) {
    const track = document.getElementById('page-track')
    if (track) {
      const vw = window.innerWidth
      const idx = PAGE_NAMES.indexOf(currentPage || 'players')
      track.style.transition = 'none'
      track.style.transform = `translateX(${-Math.max(0, idx) * vw}px)`
    }
    if (window._snapIndicator) window._snapIndicator(PAGE_NAMES.indexOf(currentPage || 'players'))
    return
  }
  _pageSwipeInited = true

  PAGE_NAMES.forEach(p => {
    const slot = document.getElementById(`slot-${p}`)
    if (slot) slot.style.display = ''
  })

  const track     = document.getElementById('page-track')
  const indicator = document.getElementById('nav-indicator')
  const container = document.getElementById('page-container')
  if (!track || !container) return

  function indicatorLeft(idx) { return NAV_PAD + idx * (NAV_BTN_W + NAV_GAP) }

  // Wrapped in rAF for smoother animation
  function setTrack(idx, frac = 0) {
    const vw = window.innerWidth
    requestAnimationFrame(() => {
      track.style.transform = `translateX(${-(idx + frac) * vw}px)`
      if (indicator) {
        const base = indicatorLeft(idx)
        const next = indicatorLeft(idx + Math.sign(frac))
        indicator.style.left = (base + (next - base) * Math.abs(frac)) + 'px'
      }
    })
  }

  window._snapIndicator = (idx) => {
    if (indicator) indicator.style.left = indicatorLeft(idx) + 'px'
  }

  const idx0 = PAGE_NAMES.indexOf(currentPage || 'players')
  track.style.transition = 'none'
  setTrack(idx0)
  if (indicator) indicator.style.left = indicatorLeft(idx0) + 'px'

  let sx = 0, sy = 0, lx = 0, pageIdx = idx0, locked = null, active = false

  container.addEventListener('touchstart', e => {
    if (document.querySelector('.sheet.open')) return
    // Sync pageIdx with actual current page (e.g. after navigating to stats via button)
    pageIdx = PAGE_NAMES.indexOf(currentPage || 'players')
    // Stats page is not swipe-navigable
    if (pageIdx === PAGE_NAMES.indexOf('stats')) return
    sx = e.touches[0].clientX; sy = e.touches[0].clientY
    lx = sx; locked = null; active = true
    track.classList.add('dragging')
    track.style.transition = 'none'
    if (indicator) indicator.classList.add('dragging')
  }, { passive: true })

  container.addEventListener('touchmove', e => {
    if (!active) return
    const dx = e.touches[0].clientX - sx
    const dy = e.touches[0].clientY - sy
    lx = e.touches[0].clientX
    if (!locked) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) locked = 'h'
      else if (Math.abs(dy) > 8) { locked = 'v'; active = false; track.classList.remove('dragging'); return }
      else return
    }
    if (locked !== 'h') return
    if (e.cancelable) e.preventDefault()
    const atStart = pageIdx === 0, atEnd = pageIdx >= PAGE_NAMES.length - 2
    let frac = -dx / window.innerWidth
    if ((frac < 0 && atStart) || (frac > 0 && atEnd)) frac *= 0.2
    setTrack(pageIdx, Math.max(-1, Math.min(1, frac)))
  }, { passive: false })

  const endSwipe = () => {
    if (!active) return
    active = false
    track.classList.remove('dragging')
    if (indicator) indicator.classList.remove('dragging')
    track.style.transition = ''
    if (indicator) { indicator.style.transition = '' }

    if (locked !== 'h') return

    const dx = lx - sx
    const threshold = window.innerWidth * 0.25

    // Cap at index 2 — stats page (index 3) not reachable by swipe
    let newIdx = pageIdx
    if (dx < -threshold && pageIdx < PAGE_NAMES.length - 2) newIdx++
    else if (dx > threshold && pageIdx > 0) newIdx--

    pageIdx = newIdx
    const page = PAGE_NAMES[pageIdx]

    // Close player detail when leaving players page
    if (pageIdx !== 0 && window.closeDetail) window.closeDetail()

    setCurrentPage(page)
    setTrack(pageIdx)
    _updateNavActive(page)
    _updateFloatingFab(page)
    if (window._snapIndicator) window._snapIndicator(pageIdx)
    emit('page:changed', page)
  }

  container.addEventListener('touchend', endSwipe, { passive: true })
  container.addEventListener('touchcancel', endSwipe, { passive: true })
}
