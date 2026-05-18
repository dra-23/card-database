import './style.css'
import { initTheme, getThemePref, setThemePref } from './theme.js'
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged } from './firebase.js'
import { renderShell } from './shell.js'
import * as state from './state.js'
import { PAGE_NAMES, isWideLayout, isThreePaneLayout, _applyWideLayout, _applyMobileLayout, initPageSwipe, switchPage, _commitPageSwitch, _updateNavActive, _updateFloatingFab, _wideQuery, _foldQuery, _threePaneQuery } from './layout.js'
import { attachSheetGestures, attachFormDismissGesture, initScrollHide, initFastScroll, initCardLongPress, initInlinePanelSwipe, closeAllForms, closeCardSheets } from './gestures.js'
import { renderGallery, openDetail, closeDetail, renderDetail, initCardListDelegation } from './pages/players.js'
import { renderCollectionView } from './pages/collection.js'
import { renderGradedView } from './pages/graded.js'
import { renderStats } from './pages/stats.js'
import { handleCardTap, navigateCard, closeCardSheet, refreshCurrentCardPanel } from './components/card-detail.js'
import { initGradeDropdown, openCardForm, saveCard, handleFileSelect, setFormFlag } from './components/card-form.js'
import { openPlayerForm, savePlayer, handlePlayerFileSelect, createPlayerEditSheet, openPlayerEditMenu, closePlayerEdit } from './components/player-forms.js'
import { createOverflowMenu, openRowMenu } from './components/overflow-menu.js'
import { openPSASheet, closePSASheet, fetchAndPreviewPSA, savePSAData } from './components/psa-sheet.js'
import { openCardSearch, closeCardSearch, initCardSearch } from './components/card-search.js'
import { openLightbox, closeLightbox, isLightboxOpen, initLightbox } from './components/lightbox.js'
import { openBadgePicker, closeBadgePicker, initBadgePicker } from './components/badge-picker.js'

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

onAuthStateChanged(auth, user => {
  if (user) {
    authScreen.style.display = 'none'
    appShell.style.display   = 'flex'
    if (!isWideLayout()) navBar.style.display = 'flex'
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
    if (page === 'stats')      renderStats()
    const titleMap = { players: 'Players', collection: 'Collection', graded: 'Graded', stats: 'Profile' }
    const tb = document.getElementById('topBarTitle')
    if (tb && !(page === 'players' && state.selectedPlayer)) tb.textContent = titleMap[page] || page
    _syncTopBarSearch(page)
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

  // Gestures
  attachSheetGestures('cardDetailSheet',    'cardDetailPanel',    'swipeHint',     'swipeHintRight',     'player')
  attachSheetGestures('collectionCardSheet','collectionCardPanel','swipeHintColl', 'swipeHintCollRight', 'collection')
  attachSheetGestures('gradedCardSheet',    'gradedCardPanel',    'swipeHintGrad', 'swipeHintGradRight', 'graded')
  attachFormDismissGesture('cardSearchSheet', closeAllForms)
  attachFormDismissGesture('cardFormSheet',   closeAllForms)
  attachFormDismissGesture('playerFormSheet', closeAllForms)
  attachFormDismissGesture('psaSheet',        closePSASheet)
  attachFormDismissGesture('badgePickerSheet', closeBadgePicker)
  initBadgePicker()
  initCardSearch()
  initLightbox()

  initFastScroll(document.getElementById('detailScrollBody'),     document.getElementById('detailFastScroll'))
  initFastScroll(document.getElementById('collectionScrollBody'), document.getElementById('collFastScroll'))
  initCardListDelegation()
  initCardLongPress()
  initInlinePanelSwipe()

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
    } else if (document.getElementById('cardSearchSheet').classList.contains('open')) {
      closeCardSearch()
      const scrim = document.getElementById('globalScrim')
      if (scrim) scrim.style.display = 'none'
    } else if (document.getElementById('cardFormSheet').classList.contains('open') ||
        document.getElementById('playerFormSheet').classList.contains('open')) {
      closeAllForms()
    } else if (['cardDetailSheet','collectionCardSheet','gradedCardSheet'].some(id => document.getElementById(id).classList.contains('open'))) {
      closeCardSheets()
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
  window._openCardForm       = openCardForm
  window._openPlayerEditMenu = openPlayerEditMenu
  window._openPSASheet       = openPSASheet
  window.closeDetail         = closeDetail
  window._afterPlayerDetail  = () => _syncTopBarSearch(state.currentPage)

  // Initial title
  const _tb = document.getElementById('topBarTitle')
  if (_tb) _tb.textContent = 'Players'
}

// ── Top-bar search sync (desktop only) ────────────────────────────────────
const _searchAnchors = {}
function _syncTopBarSearch(page) {
  const slot   = document.getElementById('topBarSearchSlot')
  const topBar = document.getElementById('top-bar-global')
  if (!slot || !topBar) return

  if (!_wideQuery.matches) {
    // Restore ALL rows to their original positions when going mobile
    Object.entries(_searchAnchors).forEach(([id, { parent, sibling }]) => {
      const el = document.getElementById(id)
      if (el) { el.style.display = ''; parent.insertBefore(el, sibling) }
    })
    slot.style.display = 'none'
    topBar.classList.remove('search-active')
    return
  }

  const rowId = page === 'collection'                       ? 'collSearchRow'
              : page === 'graded'                           ? 'gradedSearchRow'
              : page === 'players' && state.selectedPlayer ? 'detailSearchRow'
              : null

  // Hide all rows currently in slot — they stay in slot, just invisible
  Array.from(slot.children).forEach(el => { el.style.display = 'none' })

  if (!rowId) {
    slot.style.display = 'none'
    topBar.classList.remove('search-active')
    return
  }

  const row = document.getElementById(rowId)
  if (!row) { slot.style.display = 'none'; topBar.classList.remove('search-active'); return }

  // Move to slot on first visit; on return visits it's already there
  if (!_searchAnchors[rowId]) {
    _searchAnchors[rowId] = { parent: row.parentElement, sibling: row.nextSibling }
    slot.appendChild(row)
  } else if (row.parentElement !== slot) {
    slot.appendChild(row) // restored to mobile, now back on desktop
  }

  row.style.display = ''
  slot.style.display = 'flex'
  topBar.classList.add('search-active')
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
      if (page === 'stats')      renderStats()
    })
  })

  // Wide FABs
  document.getElementById('addPlayerFab')?.addEventListener('click',   () => openPlayerForm())
  document.getElementById('addCardCollFab')?.addEventListener('click', () => openCardSearch('collection'))
  document.getElementById('addCardDetailFab')?.addEventListener('click', () => openCardSearch('player'))

  // Back buttons in player detail
  document.getElementById('backBtn')?.addEventListener('click', closeDetail)
  document.getElementById('backBtnWide')?.addEventListener('click', closeDetail)
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

// ── Dropdown helpers ───────────────────────────────────────────────────────
let _openDdWrap = null

function _openDd(wrapId) {
  if (_openDdWrap && _openDdWrap !== wrapId) _closeDd()
  const wrap  = document.getElementById(wrapId)
  const panel = wrap?.querySelector('.dd-panel')
  const btn   = wrap?.querySelector('.dd-btn')
  if (!wrap || !panel || !btn) return
  const rect = btn.getBoundingClientRect()
  panel.style.top   = (rect.bottom + 4) + 'px'
  panel.style.right = (window.innerWidth - rect.right) + 'px'
  panel.style.display = 'block'
  wrap.classList.add('open')
  _openDdWrap = wrapId
}

function _closeDd() {
  if (!_openDdWrap) return
  const wrap = document.getElementById(_openDdWrap)
  if (wrap) { const p = wrap.querySelector('.dd-panel'); if (p) p.style.display = 'none'; wrap.classList.remove('open') }
  _openDdWrap = null
}

// ── Wire filter/sort dropdowns ─────────────────────────────────────────────
function wireFilterChips() {
  // Global close on outside click or scroll
  document.addEventListener('click', e => {
    if (!_openDdWrap) return
    if (!document.getElementById(_openDdWrap)?.contains(e.target)) _closeDd()
  }, true)
  document.addEventListener('scroll', _closeDd, true)

  // ── Sort dropdown ──────────────────────────────────────────────────
  const SORT_LABELS = { year: 'Year', sport: 'Sport', set: 'Set' }
  document.getElementById('sortDdBtn')?.addEventListener('click', () => {
    _openDdWrap === 'sortDdWrap' ? _closeDd() : _openDd('sortDdWrap')
  })
  document.querySelectorAll('#sortDdPanel .dd-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#sortDdPanel .dd-opt').forEach(o => o.classList.remove('dd-active'))
      opt.classList.add('dd-active')
      const label = document.getElementById('sortDdLabel')
      if (label) label.textContent = SORT_LABELS[opt.dataset.sort] || opt.dataset.sort
      state.setCollSortBy(opt.dataset.sort)
      renderCollectionView()
      _closeDd()
    })
  })

  // ── Collection filter dropdown ─────────────────────────────────────
  const COLL_FILTERS = {
    collWishlist: { toggle: () => state.setCollShowWishlistOnly(!state.collShowWishlistOnly), get: () => state.collShowWishlistOnly, render: () => { updateOwnedCount(); renderCollectionView() } },
    collGraded:   { toggle: () => state.setCollShowGradedOnly(!state.collShowGradedOnly),     get: () => state.collShowGradedOnly,   render: renderCollectionView },
    collRC:       { toggle: () => state.setCollFilterRC(!state.collFilterRC),                 get: () => state.collFilterRC,         render: renderCollectionView },
    collAuto:     { toggle: () => state.setCollFilterAuto(!state.collFilterAuto),             get: () => state.collFilterAuto,       render: renderCollectionView },
    collMem:      { toggle: () => state.setCollFilterMem(!state.collFilterMem),               get: () => state.collFilterMem,        render: renderCollectionView },
    collNumbered: { toggle: () => state.setCollFilterNumbered(!state.collFilterNumbered),     get: () => state.collFilterNumbered,   render: renderCollectionView },
  }
  function _updateCollFilterBtn() {
    const count = Object.values(COLL_FILTERS).filter(f => f.get()).length
    const btn = document.getElementById('collFilterDdBtn')
    const lbl = document.getElementById('collFilterDdLabel')
    if (btn) btn.classList.toggle('dd-active', count > 0)
    if (lbl) lbl.textContent = count > 0 ? `Filter · ${count}` : 'Filter'
  }
  document.getElementById('collFilterDdBtn')?.addEventListener('click', () => {
    _openDdWrap === 'collFilterDdWrap' ? _closeDd() : _openDd('collFilterDdWrap')
  })
  document.querySelectorAll('#collFilterDdPanel .dd-check-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const f = COLL_FILTERS[opt.dataset.chip]
      if (!f) return
      f.toggle()
      opt.classList.toggle('dd-checked', f.get())
      _updateCollFilterBtn()
      f.render()
    })
  })

  // ── Detail (player) filter dropdown ───────────────────────────────
  const DETAIL_FILTERS = {
    wishlist: { toggle: () => state.setShowWishlistOnly(!state.showWishlistOnly), get: () => state.showWishlistOnly, render: () => { if (state.selectedPlayer) renderDetail(state.selectedPlayer) } },
    graded:   { toggle: () => state.setShowGradedOnly(!state.showGradedOnly),    get: () => state.showGradedOnly,   render: () => { if (state.selectedPlayer) renderDetail(state.selectedPlayer) } },
  }
  function _updateDetailFilterBtn() {
    const count = Object.values(DETAIL_FILTERS).filter(f => f.get()).length
    const btn = document.getElementById('detailFilterDdBtn')
    const lbl = document.getElementById('detailFilterDdLabel')
    if (btn) btn.classList.toggle('dd-active', count > 0)
    if (lbl) lbl.textContent = count > 0 ? `Filter · ${count}` : 'Filter'
  }
  document.getElementById('detailFilterDdBtn')?.addEventListener('click', () => {
    _openDdWrap === 'detailFilterDdWrap' ? _closeDd() : _openDd('detailFilterDdWrap')
  })
  document.querySelectorAll('#detailFilterDdPanel .dd-check-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const f = DETAIL_FILTERS[opt.dataset.chip]
      if (!f) return
      f.toggle()
      opt.classList.toggle('dd-checked', f.get())
      _updateDetailFilterBtn()
      f.render()
    })
  })
}
