import { cardsight } from '../cardsight.js'
import { resolveParallel, isBudgetError } from './market-value.js'

// Graded population for a card from Cardsight (replaces the PSA cert lookup,
// whose free API was discontinued in Oct 2026). Needs the card linked to
// Cardsight (CardsightId) and a grading company + grade.
//
// Resolves to { pop, popHigher, total, company, grade, variant, syncedAt }
// or throws an Error with a message fit to show the user.
const failMsg = err => isBudgetError(err) ? 'Monthly Cardsight limit reached.' : 'Couldn’t reach Cardsight. Try again later.'

export async function lookupPopulation(card) {
  const company = card?.['Grading Company']
  if (!company || company === 'Raw') throw new Error('Set a grading company first.')
  const grade = parseFloat(String(card.Grade || '').match(/\d+(\.\d+)?/)?.[0])
  if (isNaN(grade)) throw new Error('Set a grade on the card first.')
  if (!card.CardsightId) throw new Error('Link this card to Cardsight first (Market Value → Find on Cardsight).')

  // Same parallel the pricing uses, so the pop matches the priced variant
  const { info, error: parErr } = await resolveParallel(card, false)
  if (parErr) throw new Error(failMsg(parErr))
  const parallelId = info?.id || null

  const { data, error } = await cardsight.population.card(card.CardsightId)
  if (error || !data) throw new Error(failMsg(error))

  const variant = parallelId ? (data.parallels || []).find(p => p.parallel_id === parallelId) : data.base
  const variantName = parallelId ? (info.name || 'this parallel') : 'the base card'
  if (!variant) throw new Error(`Cardsight has no population data for ${variantName} yet.`)

  const co = (variant.grading_companies || []).find(g => g.name?.toUpperCase() === company.toUpperCase())
  if (!co) throw new Error(`Cardsight has no ${company} population for ${variantName}.`)

  // Standard grading scale; BGS Black Label is a separate grading type
  const types = co.grading_types || []
  const black = card.LabelTier === 'black'
  const type = black
    ? types.find(t => /black/i.test(t.name))
    : types.find(t => /standard/i.test(t.name)) || types.find(t => !/black/i.test(t.name)) || types[0]
  if (!type) throw new Error(`Cardsight has no ${company} Black Label population for ${variantName}.`)
  const entries = (type?.grades || []).map(g => ({ ...g, n: parseFloat(g.grade) })).filter(g => !isNaN(g.n))
  const at = entries.find(g => g.n === grade)
  if (!at) throw new Error(`Cardsight has no ${company} ${grade} grade for this card.`)

  const count = g => (g.population || 0) + (g.qualified_population || 0)
  return {
    pop: at.population || 0,
    popHigher: entries.filter(g => g.n > grade).reduce((s, g) => s + count(g), 0),
    total: co.total_population || 0,
    company,
    grade: black ? `${at.grade} Black Label` : at.grade,
    variant: variantName,
    syncedAt: co.last_synced_at || null,
  }
}
