import './style.css'
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged } from './firebase.js'
import { renderShell } from './shell.js'
import * as state from './state.js'
import { PAGE_NAMES, isWideLayout, _applyWideLayout, _applyMobileLayout, initPageSwipe, switchPage, _commitPageSwitch, _updateNavActive, _updateFloatingFab, _wideQuery } from './layout.js'
import { attachSheetGestures, attachFormDismissGesture, initScrollHide, initFastScroll, initCardLongPress, initInlinePanelSwipe, closeAllForms, closeCardSheets } from './gestures.js'
import { renderGallery, openDetail, closeDetail, renderDetail, initCardListDelegation } from './pages/players.js'
import { renderCollectionView } from './pages/collection.js'
import { renderGradedView } from './pages/graded.js'
import { renderStats } from './pages/stats.js'
import { handleCardTap, navigateCard, closeCardSheet, refreshCurrentCardPanel } from './components/card-detail.js'
import { initGradeDropdown, openCardForm, saveCard, handleFileSelect, setFormFlag } from './components/card-form.js'
import { openPlayerForm, savePlayer, createPlayerEditSheet, openPlayerEditMenu, closePlayerEdit } from './components/player-forms.js'
import { createOverflowMenu, openRowMenu } from './components/overflow-menu.js'
import { openPSASheet, closePSASheet, fetchAndPreviewPSA, savePSAData } from './components/psa-sheet.js'

// ── Render app shell HTML first ────────────────────────────────────────────
renderShell()

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
    if (page === 'collection') renderCollectionView()
    if (page === 'graded')     renderGradedView()
    if (page === 'stats')      renderStats()
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
  attachFormDismissGesture('cardFormSheet',   closeAllForms)
  attachFormDismissGesture('playerFormSheet', closeAllForms)
  attachFormDismissGesture('psaSheet',        closePSASheet)

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

  // Adaptive layout change listener
  _wideQuery.addEventListener('change', e => {
    requestAnimationFrame(() => {
      if (e.matches) _applyWideLayout()
      else           _applyMobileLayout()
    })
  })

  // Sign out
  document.getElementById('signOutBtn')?.addEventListener('click', signOutUser)

  // Back button / history
  window.addEventListener('popstate', e => {
    if (document.getElementById('psaSheet').classList.contains('open')) {
      closePSASheet()
    } else if (document.getElementById('cardFormSheet').classList.contains('open') ||
        document.getElementById('playerFormSheet').classList.contains('open')) {
      closeAllForms()
    } else if (['cardDetailSheet','collectionCardSheet','gradedCardSheet'].some(id => document.getElementById(id).classList.contains('open'))) {
      closeCardSheets()
    } else if (e.state?.v !== 'detail' && state.selectedPlayer && !isWideLayout()) {
      closeDetail()
    } else if (state.currentPage === 'stats') {
      switchPage('players')
    }
  })

  // FAB
  document.getElementById('floating-fab').addEventListener('click', () => {
    if (state.selectedPlayer) openCardForm(null, 'player')
    else if (state.currentPage === 'collection') openCardForm(null, 'collection')
    else openPlayerForm()
  })

  // Scrim — close card sheets first, then form sheets
  document.getElementById('globalScrim').addEventListener('click', () => {
    const cardSheetOpen = ['cardDetailSheet','collectionCardSheet','gradedCardSheet']
      .some(id => document.getElementById(id)?.classList.contains('open'))
    if (cardSheetOpen) closeCardSheets()
    else closeAllForms()
  })

  // Page swipe init after tick
  requestAnimationFrame(() => initPageSwipe())
  document.getElementById('slot-players')?.classList.add('active')

  // Expose hooks for gestures module
  window._navigateCard    = navigateCard
  window._closeCardSheet  = closeCardSheet
  window._openRowMenu     = openRowMenu
  window._openCardForm    = openCardForm
  window._openPlayerEditMenu = openPlayerEditMenu
  window._openPSASheet    = openPSASheet
  window.closeDetail      = closeDetail
}

function onDataReady() {
  renderGallery()
  document.getElementById('playerGrid').classList.add('loaded')
  _updateFloatingFab(state.currentPage || 'players')
  if (isWideLayout()) _applyWideLayout()
  if (state.currentPage === 'stats') renderStats()
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
      // Tapping Players while a player is open closes detail (works on both mobile and desktop)
      if (page === 'players' && state.selectedPlayer) { closeDetail(); return }
      // Close player detail when leaving players page on mobile
      if (page !== 'players' && state.selectedPlayer && !isWideLayout()) closeDetail()
      if (page === 'stats') history.pushState({ v: 'page', page: 'stats' }, '')
      state.setCurrentPage(page)
      _commitPageSwitch(page, PAGE_NAMES.indexOf(page))
      _updateNavActive(page)
      _updateFloatingFab(page)
      if (page === 'collection') renderCollectionView()
      if (page === 'graded')     renderGradedView()
      if (page === 'stats')      renderStats()
    })
  })

  // Wide FABs
  document.getElementById('addPlayerFab')?.addEventListener('click',   () => openPlayerForm())
  document.getElementById('addCardCollFab')?.addEventListener('click', () => openCardForm(null, 'collection'))
  document.getElementById('addCardDetailFab')?.addEventListener('click', () => openCardForm(null, 'player'))

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

// ── Wire filter chips ──────────────────────────────────────────────────────
function wireFilterChips() {
  const bindChip = (chipId, toggle, render) => {
    document.getElementById(chipId)?.addEventListener('click', () => {
      toggle()
      document.getElementById(chipId).classList.toggle('active')
      render()
    })
  }
  bindChip('chipWishlist',     () => state.setShowWishlistOnly(!state.showWishlistOnly),      () => { if (state.selectedPlayer) renderDetail(state.selectedPlayer) })
  bindChip('chipGraded',       () => state.setShowGradedOnly(!state.showGradedOnly),          () => { if (state.selectedPlayer) renderDetail(state.selectedPlayer) })
  bindChip('chipCollWishlist', () => state.setCollShowWishlistOnly(!state.collShowWishlistOnly), () => { updateOwnedCount(); renderCollectionView() })
  bindChip('chipCollGraded',   () => state.setCollShowGradedOnly(!state.collShowGradedOnly),    renderCollectionView)

  // Sort chips
  document.querySelectorAll('.sort-chip[data-sort]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.sort-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      state.setCollSortBy(chip.dataset.sort)
      renderCollectionView()
    })
  })
}
