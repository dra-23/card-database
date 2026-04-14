const KEY     = import.meta.env.VITE_CARDSIGHT_KEY
const BASE    = 'https://api.cardsight.ai'

/**
 * Identify a card from a File object.
 * @param {File} file  - image file (JPEG/PNG/WebP/HEIF, max 20MB)
 * @param {string} [sport] - optional sport hint, e.g. 'basketball', 'football'
 * @returns {Promise<object>} raw API response
 */
export async function identifyCard(file, sport = null) {
  const form = new FormData()
  form.append('image', file)

  const segment = sport ? `/${encodeURIComponent(sport.toLowerCase())}` : ''
  const res = await fetch(`${BASE}/v1/identify/card${segment}`, {
    method: 'POST',
    headers: { 'X-API-Key': KEY },
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || `CardSight ${res.status}`)
  }
  return res.json()
}

/**
 * Extract a normalised card object from whatever shape the API returns.
 * Logs the raw response so field names can be verified.
 */
export function parseIdentifyResult(raw) {
  console.log('[cardsight] raw response:', raw)

  // Try common envelope shapes
  const c = raw.card ?? raw.data ?? raw.result ?? raw

  return {
    playerName:   c.player_name  ?? c.player   ?? c.athlete    ?? c.name        ?? '',
    year:         c.year?.toString()            ?? c.season?.toString()          ?? '',
    set:          c.set_name     ?? c.set       ?? c.product    ?? c.product_name ?? '',
    number:       c.card_number?.toString()     ?? c.number?.toString()          ?? '',
    manufacturer: c.manufacturer ?? c.brand     ?? c.company    ?? '',
    sport:        c.sport        ?? c.segment   ?? '',
    team:         c.team         ?? c.team_name ?? '',
    rc:           c.is_rookie    ?? c.rookie     ?? c.rc         ?? false,
    auto:         c.is_autograph ?? c.autograph  ?? c.auto       ?? false,
    mem:          c.is_memorabilia ?? c.memorabilia ?? c.mem ?? c.patch ?? false,
    numbered:     c.is_numbered  ?? c.numbered  ?? c.serial_numbered ?? false,
  }
}
