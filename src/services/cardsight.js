const KEY  = import.meta.env.VITE_CARDSIGHT_KEY
const BASE = 'https://api.cardsight.ai'

/**
 * Identify a card from a File object.
 * @param {File} file
 * @returns {Promise<object>} raw API response
 */
export async function identifyCard(file) {
  const form = new FormData()
  form.append('image', file)

  const res = await fetch(`${BASE}/v1/identify/card`, {
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
 * Extract normalised card fields from an IdentifyResult.
 * Field names sourced from the cardsightai SDK type definitions.
 * Returns null if no detections present.
 * @param {{ success: boolean, detections?: Array }} data
 */
export function parseIdentifyResult(data) {
  console.log('[cardsight] response:', data)

  const detections = data?.detections
  if (!detections?.length) return null

  // Pick highest confidence: High > Medium > Low
  const order = { High: 0, Medium: 1, Low: 2 }
  const detection = [...detections].sort((a, b) =>
    (order[a.confidence] ?? 3) - (order[b.confidence] ?? 3)
  )[0]

  const card = detection.card ?? {}

  return {
    playerName:   card.name         ?? '',
    year:         card.year         ?? '',
    set:          card.setName      ?? card.releaseName ?? '',
    number:       card.number       ?? '',
    manufacturer: card.manufacturer ?? '',
    numbered:     !!(card.parallel?.numberedTo),
    confidence:   detection.confidence ?? 'Low',
  }
}
