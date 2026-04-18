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
    const gA = parseFloat(a.Grade) || 0, gB = parseFloat(b.Grade) || 0
    if (gB !== gA) return gB - gA
    const pA = (state.ALL_PLAYERS.find(p => p.id === a.Player)?.Player || a.Player || '').toLowerCase()
    const pB = (state.ALL_PLAYERS.find(p => p.id === b.Player)?.Player || b.Player || '').toLowerCase()
    if (pA !== pB) return pA.localeCompare(pB)
    return (a.Year?.toString() || '').localeCompare(b.Year?.toString() || '')
  })

  const counterEl = document.getElementById('gradedCounter')
  if (counterEl) counterEl.innerText = cards.length
  state.setGradedCardSequence(cards.map(c => c.id))

  const html = cards.map(c => buildGradedRow(c)).join('') ||
    `<div style="padding:48px 24px; text-align:center; opacity:0.4;"><div style="font-size:40px; margin-bottom:12px;">🏆</div><div style="font-weight:700;">No graded cards found</div></div>`
  document.getElementById('gradedList').innerHTML = html
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
      <div class="graded-tile-player">${playerName}</div>
      <div class="graded-tile-set">${c.Year || ''} ${c.Set || ''}</div>
    </div>
  </div>`
}
