import CardSightAI, { getHighestConfidenceDetection } from 'cardsightai'

const client = new CardSightAI({ apiKey: import.meta.env.VITE_CARDSIGHT_KEY })

/**
 * Identify a card from a File object.
 * @param {File} file
 * @returns {Promise<import('cardsightai').IdentifyResult>}
 */
export async function identifyCard(file) {
  const result = await client.identify.card(file)
  if (!result.ok) {
    throw new Error(result.error || result.message || `CardSight ${result.status}`)
  }
  return result.data
}

/**
 * Extract normalised card fields from an IdentifyResult.
 * Returns null if no detections or confidence is Low.
 * @param {import('cardsightai').IdentifyResult} data
 */
export function parseIdentifyResult(data) {
  console.log('[cardsight] response:', data)

  const detection = getHighestConfidenceDetection(data)
  if (!detection) return null

  const { card, confidence } = detection

  return {
    playerName:   card.name         ?? '',
    year:         card.year         ?? '',
    set:          card.setName      ?? card.releaseName ?? '',
    number:       card.number       ?? '',
    manufacturer: card.manufacturer ?? '',
    numbered:     !!(card.parallel?.numberedTo),
    confidence,   // 'High' | 'Medium' | 'Low'
  }
}
