export const SPORT_ICONS = {
  Basketball: '🏀',
  Football: '🏈',
  Baseball: '⚾',
  Golf: '⛳',
  Hockey: '🏒',
  Soccer: '⚽',
}

export function getCleanImg(url) {
  if (!url) return ''
  const u = url.trim()
  if (!u.startsWith('http')) return ''

  // Convert Google Drive share/view links to direct image URLs
  // Handles: /file/d/ID/view, /open?id=ID, /uc?id=ID
  const driveFile = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveFile) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`

  const driveOpen = u.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (driveOpen) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`

  const driveUc = u.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/)
  if (driveUc) return `https://drive.google.com/uc?export=view&id=${driveUc[1]}`

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
  return (str || '').replace(/'/g, "\\'")
}

export function vibrate(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms)
}
