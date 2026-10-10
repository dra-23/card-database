import { db, doc, setDoc, deleteField } from '../firebase.js'
import * as state from '../state.js'
import { cardsight } from '../cardsight.js'
import { escapeAttr } from '../utils.js'

// Manually pick which Cardsight catalog card a card is — for when automatic
// matching misses (e.g. Cardsight names it "Bo Knows Yardage", not the player)

let _cardId = null
let _scrimWasVisible = false
let _searchGen = 0

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const digits = s => String(s ?? '').replace(/\D/g, '')

function _card() { return state.ALL_CARDS.find(c => c.id === _cardId) }

function _playerName(card) {
  const p = state.ALL_PLAYERS.find(pl => pl.id === card.Player)
  return p?.Player || card.Player || ''
}

function _setStatus(msg) {
  const el = document.getElementById('csl_status')
  if (!el) return
  el.textContent = msg
  el.style.display = msg ? 'block' : 'none'
}

export function openCardsightLink(cardId) {
  _cardId = cardId
  const card = _card()
  if (!card) return

  const label = [card.Year, card.Set].filter(Boolean).join(' ') + (card.Number ? ` #${card.Number}` : '')
  document.getElementById('cslCardLabel').textContent = `${_playerName(card)} · ${label}`
  document.getElementById('cslUnlinkBtn').style.display = card.CardsightId ? '' : 'none'

  // Base set name only — parallels are picked up from the card's Set later
  const baseSet = String(card.Set || '').split(' - ')[0]
  const input = document.getElementById('csl_query')
  input.value = [card.Year, _playerName(card), baseSet].filter(Boolean).join(' ')

  const scrim = document.getElementById('globalScrim')
  _scrimWasVisible = !!(scrim && scrim.style.display === 'block')
  if (scrim) { scrim.style.zIndex = '1150'; scrim.style.display = 'block' }

  const sheet = document.getElementById('cardsightLinkSheet')
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.style.transform = ''
  sheet.classList.add('open')
  _search()
}

export function closeCardsightLink() {
  const sheet = document.getElementById('cardsightLinkSheet')
  if (!sheet) return
  _searchGen++
  sheet.style.transition = 'transform 0.35s cubic-bezier(0.1,0.7,0.1,1)'
  sheet.classList.remove('open')
  sheet.style.transform = ''
  const scrim = document.getElementById('globalScrim')
  if (scrim) {
    scrim.style.zIndex = '900'
    if (!_scrimWasVisible) scrim.style.display = 'none'
  }
}

async function _search() {
  const q = document.getElementById('csl_query').value.trim()
  const list = document.getElementById('cslResults')
  if (q.length < 2) return
  const gen = ++_searchGen
  list.innerHTML = ''
  _setStatus('Searching Cardsight…')

  const { data, error } = await cardsight.catalog.search({ q, type: 'card', take: 25 })
  if (gen !== _searchGen) return
  if (error || !data) { _setStatus('Search failed — try again'); return }

  const card = _card()
  const year = String(card?.Year || '').slice(0, 4)
  const num = digits(card?.Number)
  const isLikely = r => String(r.year || '').slice(0, 4) === year && digits(r.cardNumber) === num
  // Year + number matches first, then Cardsight's own ranking
  const results = (data.results || []).filter(r => r.id)
    .map((r, i) => ({ r, i, likely: isLikely(r), current: r.id === card?.CardsightId }))
    .sort((a, b) => (b.current - a.current) || (b.likely - a.likely) || (a.i - b.i))

  _setStatus(results.length ? '' : 'No cards found. Try fewer words, or the name printed on the card.')
  list.innerHTML = results.map(({ r, current, likely }, i) => `
    <button type="button" class="csl-row${current ? ' csl-current' : ''}" data-csl-id="${escapeAttr(r.id)}">
      <img class="cs-result-thumb" data-csl-thumb="${i}" alt="">
      <span class="csl-row-body">
        <span class="csl-row-name">${esc(r.name)}${r.cardNumber ? ` <span class="csl-num">#${esc(r.cardNumber)}</span>` : ''}</span>
        <span class="csl-row-meta">${esc([r.year, r.releaseName, r.setName !== 'Base Set' ? r.setName : ''].filter(Boolean).join(' · '))}</span>
        ${current ? '<span class="csl-tag csl-tag-current">Current match</span>' : likely ? '<span class="csl-tag">Same year &amp; number</span>' : ''}
      </span>
      <span class="material-symbols-outlined csl-chevron">${current ? 'check_circle' : 'chevron_right'}</span>
    </button>`).join('')

  // Thumbnails load after the list renders
  results.forEach(({ r }, i) => {
    cardsight.images.getCard(r.id, { format: 'json' }).then(({ data }) => {
      if (gen !== _searchGen || !data?.data) return
      const img = list.querySelector(`[data-csl-thumb="${i}"]`)
      if (img) { img.src = data.data; img.classList.add('cs-result-thumb--loaded') }
    }).catch(() => {})
  })
}

async function _link(cardsightId) {
  const card = _card()
  if (!card) return
  _setStatus('Saving…')
  // Clear what was derived from the old match; the card panel re-prices it
  await setDoc(doc(db, 'Cards', card.id), {
    CardsightId: cardsightId,
    CardsightParallel: deleteField(),
    MarketValue: deleteField(),
    MarketValueAt: deleteField(),
  }, { merge: true })
  closeCardsightLink()
}

async function _unlink() {
  const card = _card()
  if (!card) return
  await setDoc(doc(db, 'Cards', card.id), {
    CardsightId: deleteField(),
    CardsightParallel: deleteField(),
    MarketValue: deleteField(),
    MarketValueAt: deleteField(),
  }, { merge: true })
  closeCardsightLink()
}

export function initCardsightLink() {
  document.getElementById('cslSearchBtn')?.addEventListener('click', _search)
  document.getElementById('csl_query')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _search() } })
  document.getElementById('cslCancelBtn')?.addEventListener('click', closeCardsightLink)
  document.getElementById('cslUnlinkBtn')?.addEventListener('click', _unlink)
  document.getElementById('cslResults')?.addEventListener('click', e => {
    const row = e.target.closest('[data-csl-id]')
    if (!row) return
    if (row.dataset.cslId === _card()?.CardsightId) { closeCardsightLink(); return }
    _link(row.dataset.cslId)
  })
}
