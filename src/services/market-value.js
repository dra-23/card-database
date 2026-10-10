import { cardsight } from '../cardsight.js'
import { deleteField } from '../firebase.js'

// Recently fetched responses, so re-rendering a card panel (every Firestore
// snapshot does) or swiping back to a card doesn't spend another API call
const FRESH_MS = 5 * 60 * 1000
const _cache = new Map()

// Saved values older than this get rewritten even when unchanged, so
// MarketValueAt stays a meaningful "last checked" time
const RESAVE_MS = 24 * 60 * 60 * 1000

async function cached(key, fetcher, force) {
  const hit = _cache.get(key)
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.res
  const res = await fetcher()
  if (!res.error && res.data) _cache.set(key, { at: Date.now(), res })
  return res
}

const norm = s => String(s ?? '').toLowerCase().replace(/[’‘]/g, "'").trim()
const truthy = v => v === true || v === 'true'
const coKey = s => { const k = norm(s); return (k === 'beckett' ? 'bgs' : k).toUpperCase() }
const sameGrade = (a, b) => {
  const x = parseFloat(a), y = parseFloat(b)
  return !isNaN(x) && !isNaN(y) ? x === y : norm(a) === norm(b)
}
const isGradedCard = c => c['Grading Company'] && c['Grading Company'] !== 'Raw'
const hasWords = (text, phrase) => { const t = norm(text); return norm(phrase).split(/\s+/).every(w => t.includes(w)) }

// Ways a parallel shows up in a set name or listing title. Topps' 1984–91
// glossy sets go by Tiffany, Collector's Edition and Limited Edition
// interchangeably: "Limited Edition (Tiffany)" → full name, "tiffany", …
const TIFFANY_RE = /tiffany|collector'?s edition|limited edition/
function parallelTerms(name) {
  const n = norm(name)
  const terms = new Set([n])
  const m = n.match(/\(([^)]+)\)/)
  if (m) terms.add(m[1].trim())
  if (TIFFANY_RE.test(n)) terms.add('tiffany')
  return [...terms]
}
const mentions = (text, terms) => terms.some(t => hasWords(text, t))

// Bump when the saved shape or matching rules change, so cards re-resolve
const PARALLEL_V = 2

// Which Cardsight parallel this card is, matched from its Set name. Saved on
// the card (keyed to its CardsightId + Set) so it's only looked up once.
async function resolveParallel(card, force) {
  const sig = `${PARALLEL_V}|${card.CardsightId}|${card.Set || ''}`
  if (card.CardsightParallel?.sig === sig) return { info: card.CardsightParallel, fresh: false }

  const { data, error } = await cached(`cat:${card.CardsightId}`, () => cardsight.catalog.cards.get(card.CardsightId), force)
  if (error || !data) return { info: null, fresh: false }

  const set = card.Set || ''
  const parallels = (data.parallels || []).map(p => ({ id: p.id, name: p.name, terms: parallelTerms(p.name) }))
  // Longest name wins, so "Gold Refractor" beats "Refractor"
  const match = parallels
    .filter(p => mentions(set, p.terms))
    .sort((a, b) => b.name.length - a.name.length)[0] || null
  const searchTerm = match && (match.terms.includes('tiffany') ? 'tiffany' : match.terms[match.terms.length - 1])
  const info = {
    sig,
    id: match?.id || null,
    name: match?.name || null,
    terms: match?.terms || [],
    // Every parallel's terms, to keep parallel sales out of a base card's price
    otherTerms: parallels.flatMap(p => p.terms),
    player: data.name || '',
    q: match ? [data.releaseYear, data.releaseName, searchTerm, data.name].filter(Boolean).join(' ') : null,
  }
  return { info, fresh: true }
}

// Sales for exactly this card's grading company + grade (or raw). No
// borrowing another grade's or company's sales when the exact one is missing.
function exactGradeRecords(data, card) {
  if (!data) return []
  if (!isGradedCard(card)) return data.raw?.records || []
  const co = data.graded?.find(g => coKey(g.company_name) === coKey(card['Grading Company']))
  return co?.grades?.find(g => sameGrade(g.grade_value, card.Grade))?.records || []
}

// Grader + grade named in a listing title ("PSA 8", "Beckett 8.5", "SGC 9.5")
function titleGrade(title) {
  const m = String(title).match(/\b(PSA|BGS|Beckett|SGC|CGC)\b(?:\s*(?:gem\s*mint|gem\s*mt|mint|nm-?mt))?\s*(\d{1,2}(?:\.5)?)?\b/i)
  return m ? { co: coKey(m[1]), grade: m[2] ? parseFloat(m[2]) : null } : null
}
// Slabbed by someone else, or graded without saying by whom
const OTHER_SLAB_RE = /\b(graded|slab|slabbed|cert|csg|hga|bccg|ksa|gma|isa|mnt|ags|tag|gem elite|pristine)\b/i

// Title-search results aren't sorted into grades, so filter them to listings
// that describe this exact card: same grade, same number, no autos or lots
function titleFitsCard(title, card, info) {
  if (!mentions(title, info.terms)) return false
  const last = info.player.split(/\s+/).pop()
  if (last && !hasWords(title, last)) return false
  const g = titleGrade(title)
  if (isGradedCard(card)) {
    if (!g || g.co !== coKey(card['Grading Company']) || g.grade == null || !sameGrade(g.grade, card.Grade)) return false
  } else if (g || OTHER_SLAB_RE.test(title)) {
    return false
  }
  if (!truthy(card.Auto) && /\b(auto|autograph|autographed|signed)\b/i.test(title)) return false
  if (/\b(lot|reprint|rp)\b/i.test(title)) return false
  const num = String(card.Number || '').replace(/\D/g, '')
  const tn = String(title).match(/#\s*[a-z]*(\d+)/i)
  if (num && tn && tn[1] !== num) return false
  return true
}

const average = recs => recs.reduce((s, r) => s + r.price, 0) / recs.length
const median = nums => {
  const a = [...nums].sort((x, y) => x - y), mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}
// A "parallel" sale at or below what the regular card typically goes for is
// almost always a base card listed under the parallel's name
const MISLABEL_FLOOR = 1.5

// Prices one linked card. Returns { mv, fields, parallel, error }:
// mv is { value, sales, lastDate, source } or null when there's no exact
// match; fields is what to save on the card (null when nothing changed).
export async function priceCard(card, { force = false } = {}) {
  if (!card.CardsightId) return { mv: null, fields: null, error: 'unlinked' }
  const { info, fresh } = await resolveParallel(card, force)
  const pid = info ? (info.id || 'null') : undefined // 'null' asks for the base card only

  const getPricing = p => cached(`price:${card.CardsightId}:${p ?? 'all'}`,
    () => cardsight.pricing.get(card.CardsightId, p ? { parallel_id: p } : undefined), force)
  const res = await getPricing(pid)
  if (res.error || !res.data) return { mv: null, fields: null, error: res.error || 'no response' }

  let records = exactGradeRecords(res.data, card)
  let source = 'sales'
  if (info && !info.id) {
    // Cardsight files many parallel sales under the base card — keep them
    // out of a base card's price
    records = records.filter(r => !mentions(r.title, info.otherTerms))
  } else if (info?.id) {
    // Parallel: Cardsight files few (and sometimes the wrong) sales under the
    // parallel, so keep only listings that name it, and add sold listings
    // found by title search
    records = records.filter(r => mentions(r.title, info.terms))
    if (info.q) {
      const s = await cached(`search:${info.q}`, () => cardsight.pricing.search({ q: info.q, period: 'all', limit: 100 }), force)
      const urls = new Set(records.map(r => r.url))
      const found = (s.data?.results || []).filter(r => typeof r.price === 'number' && !urls.has(r.url) && titleFitsCard(r.title, card, info))
      if (found.length) { records = [...records, ...found]; source = 'title-search' }
    }
    // Drop sales priced like the regular card — mislabeled base cards
    const base = await getPricing('null')
    const baseRecs = exactGradeRecords(base.data, card).filter(r => !mentions(r.title, info.otherTerms))
    if (baseRecs.length >= 3) {
      const floor = median(baseRecs.map(r => r.price)) * MISLABEL_FLOOR
      records = records.filter(r => r.price > floor)
    }
    records.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }

  const fields = fresh ? { CardsightParallel: info } : {}
  const saved = savedMarketValue(card)
  if (!records.length) {
    // Don't keep showing a value computed under looser rules
    if (saved != null) Object.assign(fields, { MarketValue: deleteField(), MarketValueAt: deleteField() })
    return { mv: null, fields: Object.keys(fields).length ? fields : null, parallel: info?.name || null }
  }

  const mv = { value: average(records), sales: records.length, lastDate: records[0]?.date || null, source }
  const value = Math.round(mv.value * 100) / 100
  const stale = !card.MarketValueAt || Date.now() - card.MarketValueAt > RESAVE_MS
  if (force || stale || saved !== value) Object.assign(fields, { MarketValue: value, MarketValueAt: Date.now() })
  return { mv, fields: Object.keys(fields).length ? fields : null, parallel: info?.name || null }
}

const digits = s => String(s ?? '').replace(/\D/g, '')

// Finds this card in the Cardsight catalog. A result only counts if its year
// and card number match — Cardsight's top hit is often a different card of
// the same player and set. Returns the catalog card id, or null.
export async function findCardsightMatch(card, playerName) {
  // Card number excluded from the query — including it causes 0 results in
  // CardSight text search. Year-first ordering matches its release indexing.
  const seen = new Set()
  const queries = [
    [card.Year, playerName, card.Set         ],
    [card.Year, playerName, card.Manufacturer],
    [card.Year, playerName                   ],
    [playerName,            card.Manufacturer],
    [playerName,            card.Set         ],
  ]
    .map(parts => parts.filter(Boolean).join(' ').trim())
    .filter(q => q && !seen.has(q) && seen.add(q))

  const year = String(card.Year || '').slice(0, 4)
  const num  = digits(card.Number)
  const set  = norm(card.Set)
  // Prefer the release the card's set names ("Topps Traded" over "Topps")
  const score = r => { const rel = norm(r.releaseName); return rel && set.includes(rel) ? rel.length : 0 }

  for (const q of queries) {
    const { data, error } = await cardsight.catalog.search({ q, type: 'card', take: 20 })
    if (error) continue
    // A card without a number ("NNO") only matches catalog cards without one
    const hits = (data?.results || []).filter(r =>
      r.id &&
      (!year || String(r.year || '').slice(0, 4) === year) &&
      digits(r.cardNumber) === num)
    if (hits.length) return hits.sort((a, b) => score(b) - score(a))[0].id
  }
  return null
}

export function savedMarketValue(card) {
  const v = card.MarketValue
  return typeof v === 'number' && isFinite(v) ? v : null
}
