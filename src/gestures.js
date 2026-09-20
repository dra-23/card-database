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
  ;['cardSearchSheet', 'cardFormSheet', 'playerFormSheet', 'psaSheet'].forEach(id => {
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
  const nb = document.getElementById('nav-bar')
  if (nb) { nb.style.transition = 'transform 0.35s cubic-bezier(0.05,0.7,0.1,1)'; nb.style.transform = 'translateX(-50%) translateY(0)' }
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

  const st = { active: false, locked: null, startX: 0, startY: 0, lastX: 0, lastY: 0, sheetBaseY: 0, panelScrollTop: 0 }

  sheet.addEventListener('touchstart', e => {
    if (window._swipeAnimating) return
    const t = e.touches[0]
    st.active = true; st.locked = null
    st.startX = t.clientX; st.startY = t.clientY
    st.lastX  = t.clientX; st.lastY  = t.clientY
    st.sheetBaseY = getSheetTranslateY(sheet)
    st.panelScrollTop = panel.scrollTop
    panel.classList.remove('animating')
    sheet.style.transition = 'none'
  }, { passive: true })

  sheet.addEventListener('touchmove', e => {
    if (!st.active || window._swipeAnimating) return
    const t = e.touches[0]
    const dx = t.clientX - st.startX, dy = t.clientY - st.startY
    st.lastX = t.clientX; st.lastY = t.clientY

    if (!st.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        st.locked = 'horizontal'
      } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        // Only treat as dismiss if panel is at top AND user is swiping down
        st.locked = (dy > 0 && st.panelScrollTop <= 0) ? 'vertical' : 'scroll'
      } else {
        return
      }
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
    // 'scroll': no preventDefault — let native scroll handle it
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
      // 'scroll' or no gesture — restore transforms without interfering with scroll position
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
      setTimeout(() => { dismissFn() }, 320)
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

// ── Collapsible header scroll-hide (gallery / stats) ────────────────────────
export function initScrollHide() {
  const pairs = [
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

// ── Player detail hero (banner) ─────────────────────────────────────────────
// The decorative banner (#detailHeroDecorative) is visible only right at the
// top of the list — any scroll away from the top hides it, and only
// scrolling all the way back to the top brings it back. Unlike the compact
// bar below, this one deliberately ignores scroll direction.
export function initDetailHeroCollapse() {
  const el   = document.getElementById('detailScrollBody')
  const hero = document.getElementById('detailHeroDecorative')
  if (!el || !hero) return

  // Keep --hero-h in sync with the hero's true rendered height (name/pill
  // text can wrap to more lines) — #detailCompactHeader's margin-top spacer
  // reads this so it sits right below the hero at rest. Set on .master-col
  // (common ancestor of hero + compact bar) since custom properties only
  // inherit down the tree from where they're set.
  const masterCol = hero.closest('.master-col')
  if (masterCol && 'ResizeObserver' in window) {
    new ResizeObserver(([entry]) => {
      masterCol.style.setProperty('--hero-h', `${Math.ceil(entry.contentRect.height)}px`)
    }).observe(hero)
  }

  const TOP_THRESHOLD = 8
  const TRANSITION = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)'
  let ticking = false

  // No cached "shown" state to fall out of sync with the actual inline
  // style (e.g. across player switches, or a scroll event firing during a
  // content re-render) — every tick just applies the transform that matches
  // the current scrollTop, unconditionally.
  el.addEventListener('scroll', () => {
    if (ticking) return; ticking = true
    requestAnimationFrame(() => {
      ticking = false
      hero.style.transition = TRANSITION
      hero.style.transform  = el.scrollTop <= TOP_THRESHOLD ? 'translateY(0)' : 'translateY(-100%)'
    })
  }, { passive: true })
}

// ── Player detail compact bar (back + name + search) ────────────────────────
// Same technique and feel as the floating nav toolbar (initNavBarAutoHide
// below): hides on scroll-down, reveals immediately on scroll-up from
// anywhere in the list — independent of the hero banner above, which only
// ever shows at the very top.
// Only the year-group-header currently pinned at its sticky boundary needs
// the hidden-bar compensation transform (.yh-compensate) — any other header
// still sitting in normal document flow further down the page must never
// get it, or it visually jumps out of its own layout position and leaves a
// gap before its own card list. A blanket ancestor-class selector (the
// previous approach) applied the offset to every header on the page, stuck
// or not, since CSS alone can't tell which one is actually docked.
function _updateStuckYearHeaders(selector, stickOffset, hidden) {
  document.querySelectorAll(selector).forEach(h => {
    // A genuinely pinned header renders between 0 (already compensated) and
    // stickOffset (not yet compensated) — never negative. Without the lower
    // bound, a header long since scrolled past and pushed out by a later
    // one (native sticky handoff) would also match "top <= stickOffset"
    // (its top is deeply negative), and get the class for no reason.
    const top = h.getBoundingClientRect().top
    const stuck = top >= -1 && top <= stickOffset + 1
    const shouldCompensate = hidden && stuck
    if (shouldCompensate === h.classList.contains('yh-compensate')) return

    // Instant, not the header's own CSS transition (used for its normal
    // scroll-driven hide/show elsewhere) — with short adjacent year groups,
    // a fast scroll can hand "stuck" duty from one header to the next several
    // times a second, and animating each handoff over 300ms means the CSS
    // transition can't keep up: it lags behind, overlapping the next header's
    // own content mid-flight. There's nothing to visually sync with here
    // (unlike the compact bar's own hide/show, which this same value also
    // reacts to, but which the bar's higher z-index already occludes for the
    // 300ms it takes to slide away, so an instant snap underneath it is
    // never actually seen).
    h.style.transition = 'none'
    h.classList.toggle('yh-compensate', shouldCompensate)
  })
}

export function initDetailCompactBar() {
  const el  = document.getElementById('detailScrollBody')
  const bar = document.getElementById('detailCompactHeader')
  if (!el || !bar) return

  const MIN_SCROLL = 40, HIDE_DELTA = 8
  const STICK_OFFSET = 62 // matches .year-group-header's CSS `top` below
  const TRANSITION = 'transform 0.3s cubic-bezier(0.05, 0.7, 0.1, 1)'

  let lastTop = el.scrollTop
  let ticking = false

  function show() { bar.style.transition = TRANSITION; bar.style.transform = 'translateY(0)' }
  function hide() { bar.style.transition = TRANSITION; bar.style.transform = 'translateY(-100%)' }
  function isHidden() { return bar.style.transform === 'translateY(-100%)' }

  el.addEventListener('scroll', () => {
    if (ticking) return; ticking = true
    requestAnimationFrame(() => {
      ticking = false
      // Wide layout: #detailCompactHeader is display:none (its content
      // relocates into the global top bar instead — see style.css), so
      // there's nothing to slide and no compensation offset for the year
      // headers to apply (their CSS top:62px is itself mobile-only there).
      if (isWideLayout()) return
      const top = el.scrollTop
      const dy  = top - lastTop
      lastTop   = top

      if (top <= MIN_SCROLL || dy < -HIDE_DELTA) show()
      else if (dy > HIDE_DELTA)                  hide()

      // The inline transform string reflects the bar's *target* state the
      // instant hide()/show() sets it, so this is correct immediately —
      // unlike getBoundingClientRect(), which mid-transition still reports
      // the bar close to its start position (elapsed time ~0 right after
      // the property changes), not where it's animating to.
      _updateStuckYearHeaders('#detailScrollBody .year-group-header', STICK_OFFSET, isHidden())
    })
  }, { passive: true })

  // Safety net for the case a scroll gesture stops the instant hide() fires:
  // no further scroll event arrives to re-check once the bar's own 300ms
  // transition actually finishes, so a header could theoretically be judged
  // against a not-yet-settled state. transitionend fires regardless of
  // subsequent scroll activity, giving one guaranteed final, authoritative
  // re-check — geometry is trustworthy here since the animation is truly over.
  bar.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return
    _updateStuckYearHeaders('#detailScrollBody .year-group-header', STICK_OFFSET, bar.getBoundingClientRect().bottom <= 1)
  })
}

// ── Collection / Graded header auto-hide ────────────────────────────────────
// Same technique as the player-detail compact bar / floating nav toolbar:
// hides on scroll-down, reveals immediately on scroll-up from anywhere.
// wrapId must already be `position: sticky` (see style.css). If given, the
// year-group-header at yearHeaderSelector gets a matching stickOffset-based
// compensation (via _updateStuckYearHeaders) while this header is hidden.
export function initAutoHideHeader(bodyId, wrapId, yearHeaderSelector, stickOffset) {
  const el  = document.getElementById(bodyId)
  const bar = document.getElementById(wrapId)
  if (!el || !bar) return

  const MIN_SCROLL = 40, HIDE_DELTA = 8
  const TRANSITION = 'transform 0.3s cubic-bezier(0.05, 0.7, 0.1, 1)'

  let lastTop = el.scrollTop
  let ticking = false

  function show() { bar.style.transition = TRANSITION; bar.style.transform = 'translateY(0)' }
  function hide() { bar.style.transition = TRANSITION; bar.style.transform = 'translateY(-100%)' }
  function isHidden() { return bar.style.transform === 'translateY(-100%)' }

  el.addEventListener('scroll', () => {
    if (ticking) return; ticking = true
    requestAnimationFrame(() => {
      ticking = false
      // Wide layout: header isn't sticky (its content is relocated into the
      // global top bar instead — see style.css), so don't slide it via
      // transform, that would just visually detach a normal static element.
      if (isWideLayout()) return
      const top = el.scrollTop
      const dy  = top - lastTop
      lastTop   = top

      if (top <= MIN_SCROLL || dy < -HIDE_DELTA) show()
      else if (dy > HIDE_DELTA)                  hide()

      // The inline transform string reflects the bar's target state
      // instantly — see the matching comment in initDetailCompactBar.
      if (yearHeaderSelector) _updateStuckYearHeaders(yearHeaderSelector, stickOffset, isHidden())
    })
  }, { passive: true })

  // Safety net: guarantees one final, authoritative re-check once the bar's
  // own transition genuinely completes, even if no further scroll event
  // fires to trigger it — see the matching comment in initDetailCompactBar.
  if (yearHeaderSelector) {
    bar.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return
      _updateStuckYearHeaders(yearHeaderSelector, stickOffset, bar.getBoundingClientRect().bottom <= 1)
    })
  }
}

// ── Floating toolbar auto-hide on scroll ───────────────────────────────────
// Hides the bottom nav pill while the user scrolls down through a list, and
// brings it back on scroll-up or once scrolling settles — same hide/show
// transform used when a card-detail sheet opens/closes (card-detail.js).
export function initNavBarAutoHide() {
  const nb = document.getElementById('nav-bar')
  if (!nb) return

  const scrollIds = ['galleryScrollBody', 'collectionScrollBody', 'gradedScrollBody', 'detailScrollBody', 'statsScrollBody']
  const HIDE_DELTA = 8
  const MIN_SCROLL = 40
  const IDLE_REVEAL_MS = 900

  function show() {
    nb.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)'
    nb.style.transform = 'translateX(-50%) translateY(0)'
  }
  function hide() {
    nb.style.transition = 'transform 0.3s cubic-bezier(0.05,0.7,0.1,1)'
    nb.style.transform = 'translateX(-50%) translateY(calc(100% + 32px + env(safe-area-inset-bottom)))'
  }

  let idleTimer = null

  scrollIds.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    let lastTop = el.scrollTop
    let ticking = false

    el.addEventListener('scroll', () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        // Don't fight the sheet-open/close transform, and nav-bar is hidden
        // entirely on wide layout anyway
        if (isWideLayout() || document.querySelector('.sheet.open')) return

        const top = el.scrollTop
        const dy  = top - lastTop
        lastTop   = top

        if (top <= MIN_SCROLL || dy < -HIDE_DELTA)  show()
        else if (dy > HIDE_DELTA)                    hide()

        clearTimeout(idleTimer)
        idleTimer = setTimeout(show, IDLE_REVEAL_MS)
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
        window._openBadgePicker?.(cardId)
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
