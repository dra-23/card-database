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

/** Returns the transform string for a sheet at a given Y offset,
 *  preserving translateX(-50%) on wide layouts. */
export function sheetTransformY(px) {
  const y = typeof px === 'number' ? `${px}px` : px
  const wide = window.matchMedia('(min-width: 768px)').matches
  return wide ? `translateX(-50%) translateY(${y})` : `translateY(${y})`
}

export function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function vibrate(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms)
}
