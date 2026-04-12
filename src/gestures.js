import { isWideLayout, isThreePaneLayout, PAGE_NAMES } from './layout.js'
import { sheetTransformY, vibrate } from './utils.js'
import * as state from './state.js'

// ── Sheet open/close helpers ───────────────────────────────────────────────
export function openSheet(sheetId) {
  const sheet = document.getElementById(sheetId)
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
  sheet.style.transform = ''
  sheet.classList.add('open')
}

export function closeSheet(sheetId) {
  const sheet = document.getElementById(sheetId)
  if (!sheet) return
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
  sheet.classList.remove('open')
  sheet.style.transform = ''
}

export function closeAllForms(opts = {}) {
  ;['cardFormSheet', 'playerFormSheet'].forEach(id => {
    const s = document.getElementById(id)
    if (!s || !s.classList.contains('open')) return
    s.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
    s.style.transform = sheetTransformY('100%')
    setTimeout(() => { s.classList.remove('open'); s.style.transform = '' }, 340)
  })
  // Player edit sheet
  const peSheet = document.getElementById('playerEditSheet')
  if (peSheet && peSheet.classList.contains('open')) {
    peSheet.classList.remove('open')
  }
  const scrim = document.getElementById('globalScrim')
  const cardSheetOpen = ['cardDetailSheet','collectionCardSheet','gradedCardSheet']
    .some(id => document.getElementById(id)?.classList.contains('open'))
  if (cardSheetOpen) {
    if (scrim) scrim.style.zIndex = '900'
  } else {
    if (scrim) { scrim.style.display = 'none'; scrim.style.zIndex = '900' }
  }
  if (scrim) scrim.onclick = () => closeAllForms()
}

export function closeCardSheets() {
  ;['cardDetailSheet','collectionCardSheet','gradedCardSheet'].forEach(id => {
    const s = document.getElementById(id)
    if (!s) return
    s.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
    s.classList.remove('open'); s.style.transform = ''
  })
  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'none'
  const nb   = document.getElementById('nav-bar')
  const ffab = document.getElementById('floating-fab')
  if (nb)   { nb.style.transition = 'transform 0.35s cubic-bezier(0.05,0.7,0.1,1)'; nb.style.transform = 'translateX(-50%) translateY(0)' }
  if (ffab) { ffab.style.transition = 'transform 0.35s cubic-bezier(0.05,0.7,0.1,1)'; ffab.style.transform = 'translateY(0)' }
  if (history.state?.v === 'card') history.back()
}

// ── Card-detail sheet swipe ────────────────────────────────────────────────
const getSheetTranslateY = (sheet) => new DOMMatrix(getComputedStyle(sheet).transform).m42

export function attachSheetGestures(sheetId, panelId, hintLId, hintRId, ctxName) {
  const sheet  = document.getElementById(sheetId)
  const panel  = document.getElementById(panelId)
  const hintL  = document.getElementById(hintLId)
  const hintR  = document.getElementById(hintRId)
  if (!sheet || !panel) return

  const st = { active: false, locked: null, startX: 0, startY: 0, lastX: 0, lastY: 0, sheetBaseY: 0 }

  sheet.addEventListener('touchstart', e => {
    if (window._swipeAnimating) return
    const t = e.touches[0]
    st.active = true; st.locked = null
    st.startX = t.clientX; st.startY = t.clientY
    st.lastX  = t.clientX; st.lastY  = t.clientY
    st.sheetBaseY = getSheetTranslateY(sheet)
    panel.classList.remove('animating')
    sheet.style.transition = 'none'
  }, { passive: true })

  sheet.addEventListener('touchmove', e => {
    if (!st.active || window._swipeAnimating) return
    const t = e.touches[0]
    const dx = t.clientX - st.startX, dy = t.clientY - st.startY
    st.lastX = t.clientX; st.lastY = t.clientY

    if (!st.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) st.locked = 'horizontal'
      else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5) st.locked = 'vertical'
      else return
    }

    if (st.locked === 'horizontal') {
      if (e.cancelable) e.preventDefault()
      const seq = ctxName === 'player' ? state.cardSequence : ctxName === 'collection' ? state.collCardSequence : state.gradedCardSequence
      const idx = seq.indexOf(state.currentCardId)
      const atStart = idx === 0, atEnd = idx === seq.length - 1
      let resistance = 1
      if ((dx > 0 && atStart) || (dx < 0 && atEnd)) resistance = 0.2
      panel.style.transform = `translateX(${dx * resistance}px)`
      if (hintL) hintL.style.opacity = (dx > 40 && !atStart) ? '1' : '0'
      if (hintR) hintR.style.opacity = (dx < -40 && !atEnd)  ? '1' : '0'
    } else if (st.locked === 'vertical') {
      if (e.cancelable) e.preventDefault()
      sheet.style.transform = sheetTransformY(Math.max(0, dy))
    }
  }, { passive: false })

  sheet.addEventListener('touchend', () => {
    if (!st.active) return
    st.active = false
    if (hintL) hintL.style.opacity = '0'
    if (hintR) hintR.style.opacity = '0'
    const dx = st.lastX - st.startX, dy = st.lastY - st.startY

    if (st.locked === 'horizontal') {
      const W = window.innerWidth
      const seq = ctxName === 'player' ? state.cardSequence : ctxName === 'collection' ? state.collCardSequence : state.gradedCardSequence
      const idx = seq.indexOf(state.currentCardId)
      if (dx < -W * 0.30 && idx < seq.length - 1) window._navigateCard?.('next', ctxName)
      else if (dx > W * 0.30 && idx > 0)          window._navigateCard?.('prev', ctxName)
      else { panel.classList.add('animating'); panel.style.transform = 'translateX(0)'; setTimeout(() => panel.classList.remove('animating'), 320) }
    } else if (st.locked === 'vertical') {
      sheet.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
      if (dy > 150) window._closeCardSheet?.(ctxName)
      else sheet.style.transform = sheetTransformY(0)
    } else {
      panel.style.transform = ''
      sheet.style.transform = sheet.classList.contains('open') ? sheetTransformY(0) : sheetTransformY('100%')
    }
    st.locked = null
  })

  sheet.addEventListener('touchcancel', () => {
    st.active = false; st.locked = null
    if (hintL) hintL.style.opacity = '0'
    if (hintR) hintR.style.opacity = '0'
    panel.classList.add('animating'); panel.style.transform = 'translateX(0)'
    sheet.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
    sheet.style.transform = sheet.classList.contains('open') ? sheetTransformY(0) : sheetTransformY('100%')
    setTimeout(() => panel.classList.remove('animating'), 320)
  }, { passive: true })
}

// ── Form dismiss gesture (swipe down) ─────────────────────────────────────
export function attachFormDismissGesture(sheetId, dismissFn) {
  const sheet  = document.getElementById(sheetId)
  if (!sheet) return
  const handle = sheet.querySelector('.sheet-handle')
  const body   = sheet.querySelector('.sheet-body')
  const fs = { active: false, startY: 0, lastY: 0, startedOnHandle: false }

  function onStart(clientY, fromHandle) {
    if (!sheet.classList.contains('open')) return
    fs.active = true; fs.startedOnHandle = fromHandle
    fs.startY = clientY; fs.lastY = clientY
    sheet.style.transition = 'none'
  }
  function onMove(clientY) {
    if (!fs.active) return
    fs.lastY = clientY
    const dy = clientY - fs.startY
    const atTop = !body || body.scrollTop <= 0
    if (dy > 0 && (fs.startedOnHandle || atTop)) {
      const dampened = dy < 80 ? dy : 80 + (dy - 80) * 0.35
      sheet.style.transform = sheetTransformY(dampened)
    } else if (dy <= 0) {
      sheet.style.transform = sheetTransformY(0)
    }
  }
  function onEnd() {
    if (!fs.active) return
    fs.active = false
    const dy = fs.lastY - fs.startY
    const atTop = !body || body.scrollTop <= 0
    sheet.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.7, 0.1, 1)'
    if (dy > 110 && (fs.startedOnHandle || atTop)) {
      sheet.style.transform = sheetTransformY('100%')
      setTimeout(() => { dismissFn(); sheet.style.transform = '' }, 320)
    } else {
      sheet.style.transform = sheetTransformY(0)
    }
  }

  if (handle) handle.addEventListener('touchstart', e => onStart(e.touches[0].clientY, true), { passive: true })
  if (body)   body.addEventListener('touchstart',   e => { if (body.scrollTop <= 0) onStart(e.touches[0].clientY, false) }, { passive: true })

  sheet.addEventListener('touchmove', e => {
    if (!fs.active) return
    const dy = e.touches[0].clientY - fs.startY
    const atTop = !body || body.scrollTop <= 0
    if (dy > 8 && (fs.startedOnHandle || atTop) && e.cancelable) e.preventDefault()
    onMove(e.touches[0].clientY)
  }, { passive: false })
  sheet.addEventListener('touchend',    onEnd, { passive: true })
  sheet.addEventListener('touchcancel', onEnd, { passive: true })
}

// ── Collapsible header scroll-hide ─────────────────────────────────────────
export function initScrollHide() {
  const pairs = [
    { bodyId: 'detailScrollBody',     wrapId: 'detailHeaderWrap'     },
    { bodyId: 'gradedScrollBody',     wrapId: 'gradedHeaderWrap'     },
    { bodyId: 'galleryScrollBody',    wrapId: 'galleryHeaderWrap'    },
    { bodyId: 'statsScrollBody',      wrapId: 'statsHeaderWrap'      },
  ]
  const COLLAPSE_THRESHOLD = 64, REVEAL_THRESHOLD = 24
  pairs.forEach(({ bodyId, wrapId }) => {
    const el   = document.getElementById(bodyId)
    const wrap = document.getElementById(wrapId)
    if (!el || !wrap) return
    let ticking = false
    el.addEventListener('scroll', () => {
      if (ticking) return; ticking = true
      requestAnimationFrame(() => {
        const y = el.scrollTop
        if (y <= REVEAL_THRESHOLD)       wrap.classList.remove('collapsed')
        else if (y > COLLAPSE_THRESHOLD) wrap.classList.add('collapsed')
        ticking = false
      })
    }, { passive: true })
  })
}

// ── Fast-scroll bar ─────────────────────────────────────────────────────────
export function initFastScroll(scrollEl, barEl) {
  if (!scrollEl || !barEl) return
  const thumb = barEl.querySelector('.fast-scroll-thumb')
  let dragging = false, barTop = 0, barH = 0

  function reposition() {
    const sr = scrollEl.getBoundingClientRect()
    const pr = barEl.parentElement.getBoundingClientRect()
    barEl.style.top    = (sr.top - pr.top) + 'px'
    barEl.style.height = sr.height + 'px'
    barTop = sr.top; barH = sr.height
  }
  function updateThumb() {
    const { scrollTop, scrollHeight, clientHeight } = scrollEl
    if (scrollHeight <= clientHeight + 2) { barEl.classList.remove('scrollable'); return }
    barEl.classList.add('scrollable')
    const thumbH = thumb.offsetHeight
    const track  = barH - thumbH
    thumb.style.top = ((scrollTop / (scrollHeight - clientHeight)) * track) + 'px'
  }

  let _lastHapticTop = -999
  function moveDrag(clientY) {
    const thumbH = thumb.offsetHeight, track = barH - thumbH
    const relY = Math.max(0, Math.min(clientY - barTop - thumbH / 2, track))
    const { scrollHeight, clientHeight } = scrollEl
    scrollEl.scrollTop = (relY / track) * (scrollHeight - clientHeight)
    if (Math.abs(scrollEl.scrollTop - _lastHapticTop) >= 80) {
      vibrate(4); _lastHapticTop = scrollEl.scrollTop
    }
  }

  scrollEl.addEventListener('scroll', updateThumb, { passive: true })
  new ResizeObserver(() => { reposition(); updateThumb() }).observe(scrollEl)

  thumb.addEventListener('touchstart', e => {
    dragging = true; reposition(); _lastHapticTop = scrollEl.scrollTop
    barEl.classList.add('dragging'); vibrate(10); e.preventDefault(); e.stopPropagation()
  }, { passive: false })
  document.addEventListener('touchmove', e => { if (dragging) { moveDrag(e.touches[0].clientY); e.preventDefault() } }, { passive: false })
  const endDrag = () => { if (!dragging) return; dragging = false; barEl.classList.remove('dragging') }
  document.addEventListener('touchend', endDrag)
  document.addEventListener('touchcancel', endDrag)
  thumb.addEventListener('mousedown', e => { dragging = true; reposition(); barEl.classList.add('dragging'); e.preventDefault() })
  document.addEventListener('mousemove', e => { if (dragging) moveDrag(e.clientY) })
  document.addEventListener('mouseup', endDrag)
  setTimeout(() => { reposition(); updateThumb() }, 300)
}

// ── Long-press context menu on card rows ───────────────────────────────────
export function initCardLongPress() {
  const LONG_PRESS_MS = 450
  const containers = [
    { id: 'cardList',       selector: '.card-item'  },
    { id: 'collectionList', selector: '.card-item'  },
    { id: 'gradedList',     selector: '.graded-tile' },
  ]

  containers.forEach(({ id, selector }) => {
    const container = document.getElementById(id)
    if (!container) return
    let timer = null, startX = 0, startY = 0, fired = false

    container.addEventListener('touchstart', e => {
      const row = e.target.closest(selector)
      if (!row || e.target.closest('.card-row-menu-btn')) return
      const t = e.touches[0]
      startX = t.clientX; startY = t.clientY; fired = false
      timer = setTimeout(() => {
        fired = true
        const cardId = row.dataset.cardId
        if (!cardId) return
        vibrate(50)
        window._openRowMenu?.(cardId, null, t.clientX, t.clientY)
      }, LONG_PRESS_MS)
    }, { passive: true })

    container.addEventListener('touchmove', e => {
      if (!timer) return
      const t = e.touches[0]
      if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) { clearTimeout(timer); timer = null }
    }, { passive: true })

    const cancel = () => { clearTimeout(timer); timer = null }
    container.addEventListener('touchend',    cancel, { passive: true })
    container.addEventListener('touchcancel', cancel, { passive: true })
    container.addEventListener('click', e => { if (fired) { e.stopImmediatePropagation(); fired = false } }, true)
  })
}

// ── Inline panel swipe (two-pane nav between cards) ────────────────────────
export function initInlinePanelSwipe() {
  ;[['twoPane-cardDetail','player'], ['twoPane-collectionDetail','collection'], ['twoPane-gradedDetail','graded']].forEach(([id, ctx]) => {
    const el = document.getElementById(id)
    if (!el) return
    let startX = 0, lastX = 0, active = false
    el.addEventListener('touchstart', e => { if (!state.currentCardId) return; startX = e.touches[0].clientX; lastX = startX; active = true }, { passive: true })
    el.addEventListener('touchmove',  e => { if (!active) return; lastX = e.touches[0].clientX; if (Math.abs(lastX - startX) > 10 && e.cancelable) e.preventDefault() }, { passive: false })
    el.addEventListener('touchend',   () => { if (!active) return; active = false; const dx = lastX - startX; if (dx < -80) window._navigateCard?.('next', ctx); else if (dx > 80) window._navigateCard?.('prev', ctx) })
  })
}
