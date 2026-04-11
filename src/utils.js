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
  return u.startsWith('http') ? u : ''
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
