import { db, collection, onSnapshot } from './firebase.js'

// ── Core data ──────────────────────────────────────────────────────────────
export let ALL_PLAYERS = []
export let ALL_CARDS   = []
export let playersLoaded = false
export let cardsLoaded   = false

// ── UI state ───────────────────────────────────────────────────────────────
export let currentPage        = 'players'
export let selectedPlayer     = null
export let currentCardId      = null
export let activeCardContext  = 'player'

// Card list filters / search (player detail page)
export let cardSearchQuery    = ''
export let showGradedOnly     = false
export let showWishlistOnly   = false

// Collection filters / search
export let collSearchQuery       = ''
export let collShowGradedOnly    = false
export let collShowWishlistOnly  = false
export let collSortBy            = 'year'

// Graded search
export let gradedSearchQuery = ''

// Navigable sequences (used by card-to-card swipe)
export let cardSequence       = []
export let collCardSequence   = []
export let gradedCardSequence = []

// ── Setters ────────────────────────────────────────────────────────────────
export function setCurrentPage(p)       { currentPage = p }
export function setSelectedPlayer(p)    { selectedPlayer = p }
export function setCurrentCardId(id)    { currentCardId = id }
export function setActiveCardContext(c) { activeCardContext = c }

export function setCardSearchQuery(v)   { cardSearchQuery = v }
export function setShowGradedOnly(v)    { showGradedOnly = v }
export function setShowWishlistOnly(v)  { showWishlistOnly = v }

export function setCollSearchQuery(v)      { collSearchQuery = v }
export function setCollShowGradedOnly(v)   { collShowGradedOnly = v }
export function setCollShowWishlistOnly(v) { collShowWishlistOnly = v }
export function setCollSortBy(v)           { collSortBy = v }

export function setGradedSearchQuery(v) { gradedSearchQuery = v }

export function setCardSequence(seq)       { cardSequence = seq }
export function setCollCardSequence(seq)   { collCardSequence = seq }
export function setGradedCardSequence(seq) { gradedCardSequence = seq }

// ── Simple event bus ───────────────────────────────────────────────────────
const _handlers = {}
export function on(event, fn)    { (_handlers[event] = _handlers[event] || []).push(fn) }
export function emit(event, ...args) { (_handlers[event] || []).forEach(fn => fn(...args)) }

// ── Firestore subscriptions ────────────────────────────────────────────────
export function subscribeFirestore() {
  onSnapshot(collection(db, 'Players'), snap => {
    ALL_PLAYERS = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    playersLoaded = true
    emit('players:updated')
    _checkReady()
  })

  onSnapshot(collection(db, 'Cards'), snap => {
    ALL_CARDS = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cardsLoaded = true
    emit('cards:updated')
    _checkReady()
  })
}

let _ready = false
function _checkReady() {
  if (!_ready && playersLoaded && cardsLoaded) {
    _ready = true
    emit('data:ready')
  }
}
