import { cardsight } from '../cardsight.js'
import { resolveParallel, isBudgetError } from './market-value.js'

// Graded population for a card from Cardsight (replaces the PSA cert lookup,
// whose free API was discontinued in Oct 2026). Needs the card linked to
// Cardsight (CardsightId) and a grading company + grade.
//
// Resolves to { pop, popHigher, total, company, grade, variant, variantId, syncedAt }
// or throws an Error with a message fit to show the user. When the expected
// version (base or the priced parallel) has no data but other versions do,
// the Error carries `choices` ([{ id, name, total }], id 'base' or a
// parallel id) so the user can say which one the card is; pass that back as
// `variantId` (it's also saved on the card as PopVariant).
const failMsg = err => isBudgetError(err) ? 'Monthly Cardsight limit reached.' : 'Couldn’t reach Cardsight. Try again later.'

export async function lookupPopulation(card, { variantId } = {}) {
  const company = card?.['Grading Company']
  if (!company || company === 'Raw') throw new Error('Set a grading company first.')
  const grade = parseFloat(String(card.Grade || '').match(/\d+(\.\d+)?/)?.[0])
  if (isNaN(grade)) throw new Error('Set a grade on the card first.')
  if (!card.CardsightId) throw new Error('Link this card to Cardsight first (Market Value → Find on Cardsight).')

  const { data, error } = await cardsight.population.card(card.CardsightId)
  if (error || !data) throw new Error(failMsg(error))

  // Which version: an explicit choice, the one picked before for this card,
  // or the same parallel the pricing uses (so pop matches the priced version)
  let pick = variantId || card.PopVariant || null
  let guessName = null
  if (!pick) {
    const { info, error: parErr } = await resolveParallel(card, false)
    if (parErr) throw new Error(failMsg(parErr))
    pick = info?.id || 'base'
    guessName = info?.name || null
  }
  const parallels = data.parallels || []
  const variant = pick === 'base' ? data.base : parallels.find(p => p.parallel_id === pick)
  const variantName = pick === 'base' ? 'the base card'
    : (variant?.parallel_name || guessName || 'this parallel')
  const coIn = v => (v?.grading_companies || []).find(g => g.name?.toUpperCase() === company.toUpperCase())
  const co = coIn(variant)

  if (!co) {
    // Offer the versions Cardsight does have this company's pop for
    const choices = [
      ...(coIn(data.base) ? [{ id: 'base', name: 'Base card', total: coIn(data.base).total_population || 0 }] : []),
      ...parallels.filter(coIn).map(p => ({ id: p.parallel_id, name: p.parallel_name, total: coIn(p).total_population || 0 })),
    ].filter(c => c.id !== pick)
    if (choices.length) {
      throw Object.assign(new Error(`Cardsight has no ${company} pop for ${variantName}, but has it for other versions of this card. Which version is yours?`), { choices })
    }
    if (!data.base && !parallels.length) throw new Error('Cardsight doesn’t have graded population data for this card yet.')
    throw new Error(`Cardsight has no ${company} population for this card yet.`)
  }

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
    variantId: pick,
    syncedAt: co.last_synced_at || null,
  }
}
