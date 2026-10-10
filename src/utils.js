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

/** Returns the transform string for a sheet at a given Y offset.
 *  On desktop (≥1280px) form sheets are right-side panels that slide on the X axis. */
export function sheetTransformY(px) {
  if (window.matchMedia('(min-width: 1280px)').matches) {
    return (px === 0 || px === '0') ? 'translateX(0)' : 'translateX(100%)'
  }
  const y = typeof px === 'number' ? `${px}px` : px
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

export function vibrate(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms)
}
