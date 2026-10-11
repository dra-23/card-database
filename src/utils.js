export const SPORT_ICONS = {
  Basketball: 'BSK',
  Football:   'FB',
  Baseball:   'BB',
  Golf:       'GLF',
  Hockey:     'HK',
  Soccer:     'SOC',
}

export function getCleanImg(url) {
  if (!url) return ''
  const u = url.trim()
  if (!u.startsWith('http')) return ''

  // Extract Google Drive file ID from any Drive URL format and use
  // the lh3.googleusercontent.com direct-image endpoint (no CORS issues)
  const driveId =
    (u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
     u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
     u.match(/drive\.google\.com\/(?:uc|thumbnail)\?.*[?&]id=([a-zA-Z0-9_-]+)/) ||
     u.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/))?.[1]

  if (driveId) return `https://lh3.googleusercontent.com/d/${driveId}`

  return u
}

/** Normalize year strings for consistent sort order.
 *  "1991-92" → "1991-92", "2024" → "2024", "" → "9999" */
export function yearSortKey(year) {
  if (!year) return '9999'
  const s = year.toString().trim()
  return s
}

export function isOwned(card) {
  return card.Owned === true || card.Owned === 'true'
}

// Form sheets that become right-side slide-in panels from tablet width up
// (see the matching rule in style.css)
const SIDE_PANEL_IDS = new Set(['cardFormSheet', 'playerFormSheet', 'cardSearchSheet', 'psaSheet', 'cardsightLinkSheet'])
const _wideMQ = window.matchMedia('(min-width: 768px)')

export function isSidePanel(sheet) {
  return _wideMQ.matches && !!sheet && SIDE_PANEL_IDS.has(sheet.id)
}

/** Transform for `sheet` dragged/offset `px` down from open ('100%' = closed).
 *  Side panels (tablet+) slide on the X axis instead; other sheets are
 *  horizontally centered from tablet up, so keep that centering. */
export function sheetTransformY(px, sheet) {
  const closed = px === '100%'
  if (isSidePanel(sheet)) return closed || (px !== 0 && px !== '0') ? 'translateX(100%)' : 'translateX(0)'
  const y = typeof px === 'number' ? `${px}px` : px
  if (_wideMQ.matches) return `translateX(-50%) translateY(${closed ? 'calc(100% + 24px)' : y})`
  return `translateY(${y})`
}

export function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// Caption for the placeholder that replaces a card image if it fails to load
// (or there isn't one): "1990 / Bowman / #378"
export function imgPh(card) {
  const lines = [String(card?.Year || ''), String(card?.Set || '').split(' - ')[0], card?.Number ? `#${card.Number}` : '']
  return `data-ph="${escapeAttr(lines.filter(Boolean).join('\n'))}"`
}

const PH_IMG = '.card-thumb, .graded-tile-img, .cd2-single-img, .cd2-psa-main-img, .st-mv-thumb'

// One capture-phase listener for every card image in the app — swaps a broken
// or empty image for a styled placeholder so lists don't show grey boxes
export function initImagePlaceholders() {
  document.addEventListener('error', e => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || !img.matches(PH_IMG) || !img.isConnected) return
    const ph = document.createElement('div')
    ph.className = `${img.className} img-ph`
    ph.setAttribute('role', 'img')
    ph.setAttribute('aria-label', 'No image')
    const mark = document.createElement('span')
    mark.className = 'material-symbols-outlined img-ph-mark'
    mark.textContent = 'style'
    const text = document.createElement('span')
    text.className = 'img-ph-text'
    text.textContent = img.dataset.ph || ''
    ph.append(mark, text)
    img.replaceWith(ph)
  }, true)
}

// Empty list state. `action` adds a button handled in main.js by its
// data-empty-clear scope ('collection' | 'detail' | 'graded').
export function emptyStateHTML({ icon, title, body = '', action = null }) {
  return `<div class="empty-state">
    <span class="material-symbols-outlined empty-state-icon">${icon}</span>
    <div class="empty-state-title">${title}</div>
    ${body ? `<div class="empty-state-body">${body}</div>` : ''}
    ${action ? `<button type="button" class="empty-state-btn" data-empty-clear="${action.scope}"><span class="material-symbols-outlined">filter_alt_off</span>${action.label}</button>` : ''}
  </div>`
}

// "Clear filters" / "Clear search" / "Clear filters and search"
export function clearLabel(hasFilters, hasSearch) {
  return hasFilters && hasSearch ? 'Clear filters and search' : hasFilters ? 'Clear filters' : 'Clear search'
}

export function vibrate(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms)
}
