import * as state from '../state.js'
import { getCleanImg, isOwned, escapeAttr } from '../utils.js'

export function renderGradedView() {
  if (!state.cardsLoaded) return

  let cards = state.ALL_CARDS.filter(c => {
    const co = c['Grading Company']
    return co && co !== 'Raw' && co !== ''
  })

  if (state.gradedSearchQuery) {
    const q = state.gradedSearchQuery.toLowerCase()
    cards = cards.filter(c =>
      (c.Year || '').toString().toLowerCase().includes(q) ||
      (c.Set || '').toLowerCase().includes(q) ||
      (c.Player || '').toLowerCase().includes(q) ||
      (c['Grading Company'] || '').toLowerCase().includes(q)
    )
  }

  cards.sort((a, b) => {
    const yA = parseInt(a.Year) || 0, yB = parseInt(b.Year) || 0
    if (yA !== yB) return yA - yB
    const setA = (a.Set || '').toLowerCase(), setB = (b.Set || '').toLowerCase()
    if (setA !== setB) return setA.localeCompare(setB)
    return String(a.Number ?? '').localeCompare(String(b.Number ?? ''), undefined, { numeric: true })
  })

  const counterEl = document.getElementById('gradedCounter')
  if (counterEl) counterEl.innerText = cards.length
  state.setGradedCardSequence(cards.map(c => c.id))

  // Group by player (preserve sort order within each group)
  const playerGroups = new Map()
  cards.forEach(c => {
    const player = state.ALL_PLAYERS.find(p => p.id === c.Player)
    const name = player ? (player.Player || player.id) : (c.Player || '(Unknown Player)')
    if (!playerGroups.has(name)) playerGroups.set(name, [])
    playerGroups.get(name).push(c)
  })

  // Sort player groups: most cards first, then alphabetical
  const sortedGroups = [...playerGroups.entries()].sort((a, b) =>
    b[1].length - a[1].length || a[0].localeCompare(b[0])
  )

  const container = document.getElementById('gradedList')
  if (!container) return

  if (sortedGroups.length === 0) {
    container.innerHTML = `<div style="padding:48px 24px; text-align:center; opacity:0.4;"><div style="font-size:40px; margin-bottom:12px;">🏆</div><div style="font-weight:700;">No graded cards found</div></div>`
    return
  }

  let html = ''
  sortedGroups.forEach(([playerName, groupCards]) => {
    html += `<div class="year-group-header"><span class="year-group-key">${playerName}</span><span class="year-count">${groupCards.length} card${groupCards.length !== 1 ? 's' : ''}</span></div>`
    html += `<div class="graded-grid">`
    groupCards.forEach(c => { html += buildGradedRow(c) })
    html += `</div>`
  })

  container.innerHTML = html
}

function buildGradedRow(c) {
  const player      = state.ALL_PLAYERS.find(p => p.id === c.Player)
  const playerName  = player ? (player.Player || player.id) : (c.Player || '')
  const co          = c['Grading Company'] || ''
  const gr          = c.Grade || ''
  const owned       = isOwned(c)
  const gradeLabel  = `${co} ${gr}`.trim()

  return `<div class="graded-tile ${!owned ? 'not-owned' : ''}" data-card-id="${escapeAttr(c.id)}" data-co="${co}">
    <img class="graded-tile-img" src="${getCleanImg(c['App Image'])}" alt="">
    <div class="graded-tile-bar">
      <div class="graded-tile-grade">${gradeLabel}</div>
      <div class="graded-tile-set">${c.Year || ''} ${c.Set || ''}</div>
    </div>
  </div>`
}
