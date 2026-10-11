import './style.css'
import { initTheme, getThemePref, setThemePref } from './theme.js'
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged } from './firebase.js'
import { renderShell } from './shell.js'
import * as state from './state.js'
import { PAGE_NAMES, isWideLayout, isThreePaneLayout, _applyWideLayout, _applyMobileLayout, initPageSwipe, switchPage, _commitPageSwitch, _updateNavActive, _updateFloatingFab, _wideQuery, _foldQuery, _threePaneQuery } from './layout.js'
import { attachSheetGestures, attachFormDismissGesture, initScrollHide, initDetailHeroCollapse, initDetailCompactBar, initAutoHideHeader, initNavBarAutoHide, initFastScroll, initCardLongPress, initInlinePanelSwipe, closeAllForms, closeCardSheets } from './gestures.js'
import { renderGallery, openDetail, closeDetail, renderDetail, initCardListDelegation } from './pages/players.js'
import { renderCollectionView } from './pages/collection.js'
import { renderGradedView } from './pages/graded.js'
import { renderStats } from './pages/stats.js'
import { handleCardTap, navigateCard, closeCardSheet, refreshCurrentCardPanel } from './components/card-detail.js'
import { initGradeDropdown, openCardForm, saveCard, handleFileSelect, setFormFlag } from './components/card-form.js'
import { openPlayerForm, savePlayer, handlePlayerFileSelect, createPlayerEditSheet, openPlayerEditMenu, closePlayerEdit } from './components/player-forms.js'
import { createOverflowMenu, openRowMenu, showDeleteConfirm } from './components/overflow-menu.js'
import { openPSASheet, closePSASheet, fetchAndPreviewPSA, savePSAData } from './components/psa-sheet.js'
import { openCardSearch, closeCardSearch, initCardSearch } from './components/card-search.js'
import { openLightbox, closeLightbox, isLightboxOpen, initLightbox } from './components/lightbox.js'
import { openBadgePicker, closeBadgePicker, initBadgePicker } from './components/badge-picker.js'
import { closeCardsightLink, initCardsightLink } from './components/cardsight-link.js'
import { initCardsightUsage } from './components/cardsight-usage.js'
import { initImagePlaceholders } from './utils.js'

// ── Apply theme before first paint ─────────────────────────────────────────
initTheme()

// ── Render app shell HTML first ────────────────────────────────────────────
renderShell()

// ── PWA native feel ────────────────────────────────────────────────────────
const _isPWA = () => window.matchMedia('(display-mode: standalone)').matches

if (_isPWA()) {
  document.body.classList.add('pwa')

  document.addEventListener('contextmenu', e => {
    if (e.shiftKey) return
    if (e.target.closest('a, img, video, audio, textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="search"]:not([disabled])')) return
    if (window.getSelection()?.toString().length > 0) return
    e.preventDefault()
  })
}

// ── Auth flow ──────────────────────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen')
const appShell   = document.getElementById('app-shell')
const navBar     = document.getElementById('nav-bar')

document.getElementById('signInBtn').addEventListener('click', signInWithGoogle)

initImagePlaceholders()

// Profile buttons (top bars and the nav rail) show the signed-in Google photo
// instead of the generic person icon — the icon stays if there's no photo or
// it fails to load
function _showProfileAvatar(user) {
  if (!user?.photoURL) return
  const swap = (iconEl, className) => {
    if (!iconEl) return
    const img = document.createElement('img')
    img.className = className
    img.alt = ''
    img.referrerPolicy = 'no-referrer'
    img.onload = () => iconEl.replaceWith(img)
    img.src = user.photoURL
  }
  document.querySelectorAll('.top-bar-icon-btn[data-page="stats"] .material-symbols-outlined')
    .forEach(icon => swap(icon, 'top-bar-avatar'))
  swap(document.querySelector('#rail-stats .material-symbols-outlined'), 'rail-avatar')
}

onAuthStateChanged(auth, user => {
  if (user) {
    authScreen.style.display = 'none'
    appShell.style.display   = 'flex'
    if (!isWideLayout()) navBar.style.display = 'flex'
    _showProfileAvatar(user)
    startApp()
  } else {
    authScreen.style.display = 'flex'
    appShell.style.display   = 'none'
    navBar.style.display     = 'none'
    document.getElementById('floating-fab').style.display = 'none'
  }
})

// ── App startup ────────────────────────────────────────────────────────────
let _appStarted = false

function startApp() {
  if (_appStarted) return
  _appStarted = true

  // Firestore
  state.subscribeFirestore()
  initCardsightUsage()
  state.on('players:updated', () => {
    updateOwnedCount()
  })
  state.on('cards:updated', () => {
    updateOwnedCount()
    renderGallery()
    if (state.selectedPlayer) renderDetail(state.selectedPlayer)
    refreshCurrentCardPanel(state.currentCardId)
    if (state.currentPage === 'collection') renderCollectionView({ preserveScroll: true })
    if (state.currentPage === 'graded')     renderGradedView()
    if (state.currentPage === 'stats')      renderStats()
  })
  state.on('data:ready', onDataReady)
  state.on('page:changed', page => {
    if (page === 'collection') renderCollectionView({ preserveScroll: true })
    if (page === 'graded')     renderGradedView()
    if (page === 'stats')      renderStats({ animate: true })
    _syncTopBarSearch(page)
    // Always reveal the floating toolbar on a fresh page — it should never
    // land hidden from a previous page's scroll position
    if (!isWideLayout()) { navBar.style.transition = ''; navBar.style.transform = 'translateX(-50%) translateY(0)' }
  })

  // Overlays & dynamic elements
  createOverflowMenu()
  createPlayerEditSheet()

  // Forms
  initGradeDropdown()
  wireFormButtons()
  wireNavButtons()
  wireSearchInputs()
  wireFilterChips()
  wireCollectionSort()
  wireEmptyStateActions()

  // Gestures
  attachSheetGestures('cardDetailSheet',    'cardDetailPanel',    'swipeHint',     'swipeHintRight',     'player')
  attachSheetGestures('collectionCardSheet','collectionCardPanel','swipeHintColl', 'swipeHintCollRight', 'collection')
  attachSheetGestures('gradedCardSheet',    'gradedCardPanel',    'swipeHintGrad', 'swipeHintGradRight', 'graded')
  attachFormDismissGesture('cardSearchSheet', closeAllForms)
  attachFormDismissGesture('cardFormSheet',   closeAllForms)
  attachFormDismissGesture('playerFormSheet', closeAllForms)
  attachFormDismissGesture('psaSheet',        closePSASheet)
  attachFormDismissGesture('cardsightLinkSheet', closeCardsightLink)
  initCardsightLink()
  attachFormDismissGesture('badgePickerSheet', closeBadgePicker)
  initBadgePicker()
  initCardSearch()
  initLightbox()

  initFastScroll(document.getElementById('detailScrollBody'),     document.getElementById('detailFastScroll'))
  initFastScroll(document.getElementById('collectionScrollBody'), document.getElementById('collFastScroll'))
  initCardListDelegation()
  initCardLongPress()
  initInlinePanelSwipe()
  initScrollHide()
  initDetailHeroCollapse()
  initDetailCompactBar()
  initAutoHideHeader('collectionScrollBody', 'collectionHeaderWrap')
  initAutoHideHeader('gradedScrollBody', 'gradedHeaderWrap')
  initNavBarAutoHide()

  // Card list delegation
  document.getElementById('cardList').addEventListener('click', e => {
    const menuBtn = e.target.closest('[data-menu-card]')
    if (menuBtn) { e.stopPropagation(); openRowMenu(menuBtn.dataset.menuCard, menuBtn); return }
  })
  document.getElementById('collectionList').addEventListener('click', e => {
    const menuBtn = e.target.closest('[data-menu-card]')
    if (menuBtn) { e.stopPropagation(); openRowMenu(menuBtn.dataset.menuCard, menuBtn); return }
  })

  // Adaptive layout change listeners (fold/unfold, window resize)
  _wideQuery.addEventListener('change', e => {
    requestAnimationFrame(() => {
      if (e.matches) {
        _applyWideLayout()
      } else {
        _applyMobileLayout()
        // If a player was open on fold, close detail so gallery is the mobile entry point
        if (state.selectedPlayer) closeDetail()
      }
      _reRenderCurrentPage()
      _syncTopBarSearch(state.currentPage)
    })
  })

  // Fold threshold (840px): re-apply layout so gallery/panel routing updates
  _foldQuery.addEventListener('change', () => {
    if (isWideLayout()) {
      requestAnimationFrame(() => {
        _applyWideLayout()
        _reRenderCurrentPage()
      })
    }
  })

  // Three-pane threshold: re-apply wide layout so gallery visibility updates
  _threePaneQuery.addEventListener('change', () => {
    if (isWideLayout()) {
      requestAnimationFrame(() => {
        _applyWideLayout()
        _reRenderCurrentPage()
      })
    }
  })

  // Sign out (nav rail button)
  document.getElementById('signOutBtn')?.addEventListener('click', signOutUser)

  // Settings page (full-screen push)
  function openSettingsPage() {
    const pref = getThemePref()
    document.querySelectorAll('#settingsThemeSegmented .theme-seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pref === pref)
    })
    history.pushState({ v: 'settings' }, '')
    document.getElementById('settings-page').classList.add('open')
  }
  function closeSettingsPage() {
    document.getElementById('settings-page').classList.remove('open')
  }
  function _syncRailThemeBtn() {
    const isDark = document.documentElement.dataset.theme === 'dark'
    const icon = document.getElementById('railThemeIcon')
    if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode'
    document.getElementById('railThemeToggle')?.classList.toggle('active', isDark)
  }
  _syncRailThemeBtn()

  document.getElementById('railThemeToggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    setThemePref(next)
    document.querySelectorAll('#settingsThemeSegmented .theme-seg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.pref === next)
    )
    _syncRailThemeBtn()
    if (state.currentPage === 'stats') renderStats()
  })

  document.getElementById('settingsBtn')?.addEventListener('click', openSettingsPage)
  document.getElementById('settingsPageBack')?.addEventListener('click', () => { history.back() })
  document.getElementById('settingsSignOutBtn')?.addEventListener('click', signOutUser)
  document.querySelectorAll('#settingsThemeSegmented .theme-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setThemePref(btn.dataset.pref)
      document.querySelectorAll('#settingsThemeSegmented .theme-seg-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.pref === btn.dataset.pref)
      )
      _syncRailThemeBtn()
      if (state.currentPage === 'stats') renderStats()
    })
  })

  // Back button / history
  window.addEventListener('popstate', e => {
    if (isLightboxOpen()) {
      closeLightbox(); return
    } else if (document.getElementById('badgePickerSheet')?.classList.contains('open')) {
      closeBadgePicker(); return
    } else if (document.getElementById('settings-page').classList.contains('open')) {
      closeSettingsPage()
    } else if (document.getElementById('psaSheet').classList.contains('open')) {
      closePSASheet()
    } else if (document.getElementById('cardsightLinkSheet').classList.contains('open')) {
      closeCardsightLink()
    } else if (document.getElementById('cardSearchSheet').classList.contains('open')) {
      closeCardSearch()
      const scrim = document.getElementById('globalScrim')
      if (scrim) scrim.style.display = 'none'
    } else if (document.getElementById('cardFormSheet').classList.contains('open') ||
        document.getElementById('playerFormSheet').classList.contains('open')) {
      closeAllForms()
    } else if (['cardDetailSheet','collectionCardSheet','gradedCardSheet'].some(id => document.getElementById(id).classList.contains('open'))) {
      closeCardSheets()
    } else if (e.state?.v === 'page' && e.state.page === 'stats' && state.currentPage !== 'stats') {
      // Back from a page one of Profile's tiles jumped to
      if (state.selectedPlayer) closeDetail()
      switchPage('stats')
    } else if (e.state?.v !== 'detail' && state.selectedPlayer && (!isWideLayout() || !isThreePaneLayout())) {
      closeDetail()
    } else if (state.currentPage === 'stats') {
      switchPage('players')
    }
  })

  // FAB (mobile pill FAB + standalone fold FAB share the same action)
  const _fabAction = () => {
    if (state.selectedPlayer) openCardSearch('player')
    else if (state.currentPage === 'collection') openCardSearch('collection')
    else openPlayerForm()
  }
  document.getElementById('floating-fab').addEventListener('click', _fabAction)
  document.getElementById('nav-fab')?.addEventListener('click', _fabAction)

  // Scrim — PSA sheet takes priority (closes to card detail), then card sheets, then forms
  document.getElementById('globalScrim').addEventListener('click', () => {
    if (document.getElementById('badgePickerSheet')?.classList.contains('open')) {
      closeBadgePicker(); return
    }
    if (document.getElementById('psaSheet')?.classList.contains('open')) {
      closePSASheet(); return
    }
    if (document.getElementById('cardsightLinkSheet')?.classList.contains('open')) {
      closeCardsightLink(); return
    }
    const cardSheetOpen = ['cardDetailSheet','collectionCardSheet','gradedCardSheet']
      .some(id => document.getElementById(id)?.classList.contains('open'))
    if (cardSheetOpen) closeCardSheets()
    else closeAllForms()
  })

  // Page swipe init after tick
  requestAnimationFrame(() => initPageSwipe())
  document.getElementById('slot-players')?.classList.add('active')

  // Expose hooks for gestures module
  window._openBadgePicker    = openBadgePicker
  window._openLightbox       = openLightbox
  window._navigateCard       = navigateCard
  window._closeCardSheet     = closeCardSheet
  window._openRowMenu        = openRowMenu
  window._confirmDeleteCard  = showDeleteConfirm
  window._openCardForm       = openCardForm
  window._openPlayerEditMenu = openPlayerEditMenu
  window._openPSASheet       = openPSASheet
  window.closeDetail         = closeDetail
  window._afterPlayerDetail  = () => _syncTopBarSearch(state.currentPage)
}

// ── Top-bar search + filter chip sync (desktop only) ──────────────────────
// On wide layouts the current page's search row moves into the global top
// bar, and its filter chips into the full-width strip under it (so the chips
// span every pane, and list + detail panes start at the same height).
const _searchAnchors = {}

// Shows exactly `id` (or nothing) inside `slot`, moving it in on first use.
// Returns whether something is shown.
function _dockInto(slot, id) {
  Array.from(slot.children).forEach(el => { el.style.display = 'none' })
  const el = id && document.getElementById(id)
  if (!el) { slot.style.display = 'none'; return false }
  if (!_searchAnchors[id]) _searchAnchors[id] = { parent: el.parentElement, sibling: el.nextSibling }
  if (el.parentElement !== slot) slot.appendChild(el)
  el.style.display = ''
  slot.style.display = 'flex'
  return true
}

function _syncTopBarSearch(page) {
  const slot      = document.getElementById('topBarSearchSlot')
  const chipsSlot = document.getElementById('topChipsSlot')
  const topBar    = document.getElementById('top-bar-global')
  if (!slot || !chipsSlot || !topBar) return

  if (!_wideQuery.matches) {
    // Restore everything to its original position when going mobile —
    // newest first, since a search row's saved sibling is its chip row
    Object.entries(_searchAnchors).reverse().forEach(([id, { parent, sibling }]) => {
      const el = document.getElementById(id)
      if (!el) return
      el.style.display = ''
      if (sibling && sibling.parentNode === parent) parent.insertBefore(el, sibling)
      else parent.appendChild(el)
    })
    slot.style.display = 'none'
    chipsSlot.style.display = 'none'
    topBar.classList.remove('search-active', 'chips-active')
    return
  }

  const detail = page === 'players' && state.selectedPlayer
  const rowId   = page === 'collection' ? 'collSearchRow'   : page === 'graded' ? 'gradedSearchRow' : detail ? 'detailSearchRow'   : null
  const chipsId = page === 'collection' ? 'collFilterChips' :                                         detail ? 'detailFilterChips' : null

  topBar.classList.toggle('search-active', _dockInto(slot, rowId))
  topBar.classList.toggle('chips-active', _dockInto(chipsSlot, chipsId))
}

function onDataReady() {
  renderGallery()
  document.getElementById('playerGrid').classList.add('loaded')
  _updateFloatingFab(state.currentPage || 'players')
  if (isWideLayout()) _applyWideLayout()
  if (state.currentPage === 'stats') renderStats()
}

function _reRenderCurrentPage() {
  if (!state.cardsLoaded) return
  renderGallery()
  if (state.selectedPlayer) renderDetail(state.selectedPlayer)
  refreshCurrentCardPanel(state.currentCardId)
  const page = state.currentPage
  if (page === 'collection') renderCollectionView()
  if (page === 'graded')     renderGradedView()
  if (page === 'stats')      renderStats()
}

function updateOwnedCount() {
  const count = state.collShowWishlistOnly
    ? state.ALL_CARDS.filter(c => c.Owned !== true && c.Owned !== 'true').length
    : state.ALL_CARDS.filter(c => c.Owned === true || c.Owned === 'true').length
  const el  = document.getElementById('totalOwnedCounter')
  const el2 = document.getElementById('totalOwnedCounterGlobal')
  if (el)  el.innerText  = count
  if (el2) el2.innerText = count
}

// ── Wire nav buttons ───────────────────────────────────────────────────────
function wireNavButtons() {
  // Mobile nav + rail nav
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page
      if (!page) return
      // Tapping Players while a player is open closes detail
      // Mobile: return early (history.back() in closeDetail handles navigation)
      // Desktop: fall through so _commitPageSwitch fires page:changed and syncs search/title
      if (page === 'players' && state.selectedPlayer) { closeDetail(); if (!isWideLayout()) return }
      // Close player detail when leaving players page on non-three-pane layouts
      if (page !== 'players' && state.selectedPlayer && (!isWideLayout() || !isThreePaneLayout())) closeDetail()
      if (page === 'stats') history.pushState({ v: 'page', page: 'stats' }, '')
      state.setCurrentPage(page)
      _commitPageSwitch(page, PAGE_NAMES.indexOf(page))
      _updateNavActive(page)
      _updateFloatingFab(page)
      _syncTopBarSearch(page)
      if (page === 'collection') renderCollectionView()
      if (page === 'graded')     renderGradedView()
      if (page === 'stats')      renderStats({ animate: true })
    })
  })

  // Wide FABs
  document.getElementById('addPlayerFab')?.addEventListener('click',   () => openPlayerForm())
  document.getElementById('addCardCollFab')?.addEventListener('click', () => openCardSearch('collection'))
  document.getElementById('addCardDetailFab')?.addEventListener('click', () => openCardSearch('player'))

  // Back button in player detail
  document.getElementById('detailSearchBackBtn')?.addEventListener('click', closeDetail)
}

// ── Wire form buttons ──────────────────────────────────────────────────────
function wireFormButtons() {
  document.getElementById('btnSaveCard')?.addEventListener('click', () => saveCard(true))
  document.getElementById('btnMarkUnsleevd')?.addEventListener('click', () => saveCard(false))
  document.getElementById('btnSavePlayer')?.addEventListener('click', savePlayer)
  document.getElementById('btnLookupPSA')?.addEventListener('click', fetchAndPreviewPSA)
  document.getElementById('btnSavePSA')?.addEventListener('click', savePSAData)
  document.getElementById('cancelPSABtn')?.addEventListener('click', closePSASheet)
  document.getElementById('cancelCardFormBtn')?.addEventListener('click', closeAllForms)
  document.querySelectorAll('[data-close-forms]').forEach(b => b.addEventListener('click', () => closeAllForms()))
  document.getElementById('cancelPlayerFormBtn')?.addEventListener('click', closeAllForms)
  document.getElementById('selectPhotoBtn')?.addEventListener('click', () => document.getElementById('f_fileInput').click())
  document.getElementById('f_fileInput')?.addEventListener('change', e => handleFileSelect(e.target))
  document.getElementById('pf_selectMainBtn')?.addEventListener('click', () => document.getElementById('pf_mainFileInput').click())
  document.getElementById('pf_selectBannerBtn')?.addEventListener('click', () => document.getElementById('pf_bannerFileInput').click())
  document.getElementById('pf_mainFileInput')?.addEventListener('change', e => handlePlayerFileSelect(e.target, 'pf_mainImgPreview', 'pf_mainImgPlaceholder'))
  document.getElementById('pf_bannerFileInput')?.addEventListener('change', e => handlePlayerFileSelect(e.target, 'pf_bannerImgPreview', 'pf_bannerImgPlaceholder'))
  document.getElementById('f_rc_btn')?.addEventListener('click',       () => setFormFlag('rc',       document.getElementById('f_rc').value       !== 'true'))
  document.getElementById('f_auto_btn')?.addEventListener('click',     () => setFormFlag('auto',     document.getElementById('f_auto').value     !== 'true'))
  document.getElementById('f_mem_btn')?.addEventListener('click',      () => setFormFlag('mem',      document.getElementById('f_mem').value      !== 'true'))
  document.getElementById('f_numbered_btn')?.addEventListener('click', () => setFormFlag('numbered', document.getElementById('f_numbered').value !== 'true'))
}

// ── Wire search inputs ─────────────────────────────────────────────────────
function wireSearchInputs() {
  const bind = (inputId, clearId, onInput) => {
    const input = document.getElementById(inputId)
    const clear = document.getElementById(clearId)
    if (!input) return
    input.addEventListener('input', () => {
      if (clear) clear.classList.toggle('visible', input.value.length > 0)
      onInput(input.value)
    })
    clear?.addEventListener('click', () => {
      input.value = ''
      clear.classList.remove('visible')
      onInput('')
      input.focus()
    })
  }
  bind('cardSearchInput', 'cardSearchClear', v => { state.setCardSearchQuery(v); if (state.selectedPlayer) renderDetail(state.selectedPlayer) })
  bind('collSearchInput', 'collSearchClear', v => { state.setCollSearchQuery(v); renderCollectionView() })
  bind('gradedSearchInput', 'gradedSearchClear', v => { state.setGradedSearchQuery(v); renderGradedView() })
}

// ── Filter chips ───────────────────────────────────────────────────────────
// Each filter is a chip that toggles with one tap; "Clear" appears at the end
// of the row while any are on. See .filter-chips in shell.js / style.css.
function _wireChipRow(rowId, filters, render) {
  const row = document.getElementById(rowId)
  if (!row) return { set() {} }
  const sync = () => {
    let active = 0
    row.querySelectorAll('[data-chip]').forEach(chip => {
      const on = !!filters[chip.dataset.chip]?.get()
      chip.classList.toggle('on', on)
      chip.setAttribute('aria-pressed', on)
      if (on) active++
    })
    row.classList.toggle('has-active', active > 0)
  }
  row.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]')
    if (chip) {
      filters[chip.dataset.chip]?.toggle()
    } else if (e.target.closest('.fchip-clear')) {
      Object.values(filters).forEach(f => { if (f.get()) f.toggle() })
    } else return
    sync()
    render()
  })
  sync()
  // Set exactly these filters on (everything else off)
  return {
    set(keys) {
      Object.entries(filters).forEach(([key, f]) => { if (f.get() !== keys.includes(key)) f.toggle() })
      sync()
    },
  }
}

const _chipRows = {}

function _clearSearch(inputId, clearId, setQuery) {
  const input = document.getElementById(inputId)
  if (input) input.value = ''
  document.getElementById(clearId)?.classList.remove('visible')
  setQuery('')
}

// "Clear filters" buttons on empty list states (utils.js → emptyStateHTML)
function wireEmptyStateActions() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-empty-clear]')
    if (!btn) return
    const scope = btn.dataset.emptyClear
    if (scope === 'collection') {
      _chipRows.coll?.set([])
      _clearSearch('collSearchInput', 'collSearchClear', state.setCollSearchQuery)
      updateOwnedCount()
      renderCollectionView()
    } else if (scope === 'detail') {
      _chipRows.detail?.set([])
      _clearSearch('cardSearchInput', 'cardSearchClear', state.setCardSearchQuery)
      if (state.selectedPlayer) renderDetail(state.selectedPlayer)
    } else if (scope === 'graded') {
      _clearSearch('gradedSearchInput', 'gradedSearchClear', state.setGradedSearchQuery)
      renderGradedView()
    }
  })
}

// ── Collection sort menu ───────────────────────────────────────────────────
const COLL_SORTS = [
  ['year',  'Year',        'calendar_month'],
  ['set',   'Set',         'layers'],
  ['sport', 'Sport',       'sports_baseball'],
  ['value', 'Value',       'payments'],
  ['gain',  'Gain / Loss', 'trending_up'],
]
const SORT_KEY = 'sleevd.collSort'

function wireCollectionSort() {
  const btn  = document.getElementById('collSortBtn')
  const menu = document.getElementById('collSortMenu')
  const label = document.getElementById('collSortLabel')
  if (!btn || !menu) return

  // Remembered per device — a convenience, so failures just fall back to Year
  try {
    const saved = localStorage.getItem(SORT_KEY)
    if (COLL_SORTS.some(([k]) => k === saved)) state.setCollSortBy(saved)
  } catch {}

  const sync = () => {
    const cur = state.collSortBy || 'year'
    label.textContent = (COLL_SORTS.find(([k]) => k === cur) || COLL_SORTS[0])[1]
    menu.innerHTML = COLL_SORTS.map(([k, name, icon]) => `
      <button type="button" class="sort-menu-opt${k === cur ? ' on' : ''}" role="menuitemradio" aria-checked="${k === cur}" data-sort="${k}">
        <span class="material-symbols-outlined">${icon}</span><span class="sort-menu-label">${name}</span><span class="material-symbols-outlined sort-menu-check">check</span>
      </button>`).join('')
  }
  const close = () => {
    if (!menu.classList.contains('open')) return
    menu.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
  }
  const open = () => {
    sync()
    const r = btn.getBoundingClientRect()
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 220)) + 'px'
    menu.style.top  = (r.bottom + 6) + 'px'
    menu.classList.add('open')
    btn.setAttribute('aria-expanded', 'true')
  }

  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.contains('open') ? close() : open() })
  menu.addEventListener('click', e => {
    const opt = e.target.closest('[data-sort]')
    if (!opt) return
    state.setCollSortBy(opt.dataset.sort)
    try { localStorage.setItem(SORT_KEY, opt.dataset.sort) } catch {}
    sync()
    close()
    renderCollectionView()
    document.getElementById('collectionScrollBody')?.scrollTo({ top: 0 })
  })
  document.addEventListener('click', e => { if (!menu.contains(e.target) && e.target !== btn) close() })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
  document.addEventListener('scroll', e => { if (!menu.contains(e.target)) close() }, true)
  addEventListener('resize', close)
  sync()
}

function wireFilterChips() {
  const flag = (get, set) => ({ get, toggle: () => set(!get()) })

  const coll = _chipRows.coll = _wireChipRow('collFilterChips', {
    collWishlist: flag(() => state.collShowWishlistOnly, state.setCollShowWishlistOnly),
    collFavorite: flag(() => state.collShowFavoriteOnly, state.setCollShowFavoriteOnly),
    collGraded:   flag(() => state.collShowGradedOnly,   state.setCollShowGradedOnly),
    collRC:       flag(() => state.collFilterRC,         state.setCollFilterRC),
    collAuto:     flag(() => state.collFilterAuto,       state.setCollFilterAuto),
    collMem:      flag(() => state.collFilterMem,        state.setCollFilterMem),
    collNumbered: flag(() => state.collFilterNumbered,   state.setCollFilterNumbered),
  }, () => { updateOwnedCount(); renderCollectionView() })

  // Profile page scorecards jump here with exactly the given filters applied
  window._showCollectionFiltered = keys => {
    coll.set(keys)
    updateOwnedCount()
    switchPage('collection')
  }

  _chipRows.detail = _wireChipRow('detailFilterChips', {
    wishlist: flag(() => state.showWishlistOnly,   state.setShowWishlistOnly),
    favorite: flag(() => state.showFavoriteOnly,   state.setShowFavoriteOnly),
    graded:   flag(() => state.showGradedOnly,     state.setShowGradedOnly),
    rc:       flag(() => state.detailFilterRC,     state.setDetailFilterRC),
    auto:     flag(() => state.detailFilterAuto,   state.setDetailFilterAuto),
    mem:      flag(() => state.detailFilterMem,    state.setDetailFilterMem),
    numbered: flag(() => state.detailFilterNumbered, state.setDetailFilterNumbered),
  }, () => { if (state.selectedPlayer) renderDetail(state.selectedPlayer) })
}
