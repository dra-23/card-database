import { cardsight } from '../cardsight.js'

// Recently fetched pricing, so re-rendering a card panel (every Firestore
// snapshot does) or swiping back to a card doesn't spend another API call
const FRESH_MS = 5 * 60 * 1000
const _cache = new Map()

// Saved values older than this get rewritten even when unchanged, so
// MarketValueAt stays a meaningful "last checked" time
const RESAVE_MS = 24 * 60 * 60 * 1000

export async function fetchPricing(cardsightId, { force = false } = {}) {
  const hit = _cache.get(cardsightId)
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return { data: hit.data, error: null }
  const res = await cardsight.pricing.get(cardsightId)
  if (!res.error && res.data) _cache.set(cardsightId, { at: Date.now(), data: res.data })
  return res
}

// Average of recent sales for the card's grading company + grade, falling
// back to raw sales. Null when there's nothing to average.
export function computeMarketValue(data, card) {
  if (!data) return null
  const co = card['Grading Company']
  const gr = String(card.Grade || '')

  let records = null
  if (co && co !== 'Raw' && data.graded?.length) {
    const cg = data.graded.find(g => g.company_name === co) || data.graded[0]
    const gg = cg?.grades?.find(g => g.grade_value === gr) || cg?.grades?.[0]
    if (gg?.records?.length) records = gg.records
  }
  if (!records?.length && data.raw?.records?.length) records = data.raw.records
  if (!records?.length) return null

  const value = records.reduce((s, r) => s + r.price, 0) / records.length
  return { value, sales: records.length, lastDate: records[0]?.date || null }
}

// Firestore fields to save for a freshly computed value, or null if the
// saved copy is already current
export function marketValueFields(card, mv, { force = false } = {}) {
  const value = Math.round(mv.value * 100) / 100
  const stale = !card.MarketValueAt || Date.now() - card.MarketValueAt > RESAVE_MS
  if (!force && !stale && card.MarketValue === value) return null
  return { MarketValue: value, MarketValueAt: Date.now() }
}

export function savedMarketValue(card) {
  const v = card.MarketValue
  return typeof v === 'number' && isFinite(v) ? v : null
}
