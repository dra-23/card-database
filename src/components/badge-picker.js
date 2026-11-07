import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'
import { promptPrice } from './price-prompt.js'
import { isOwned } from '../utils.js'

// Sleevd follows isOwned so a sold card reads as not sleevd
const isOn = (card, key) => key === 'Owned' ? isOwned(card) : (card[key] === true || card[key] === 'true')

const BADGES = [
  { key: 'Owned',    label: 'Sleevd'   },
  { key: 'Favorite', label: 'Favorite' },
  { key: 'RC',       label: 'RC'   },
  { key: 'Auto',     label: 'AUTO' },
  { key: 'Mem',      label: 'MEM'  },
  { key: 'Numbered', label: "#'d"  },
]

let _cardId = null

export function openBadgePicker(cardId) {
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return
  _cardId = cardId

  BADGES.forEach(({ key }) => {
    const btn = document.querySelector(`#badgePickerSheet [data-badge="${key}"]`)
    if (!btn) return
    const on = isOn(card, key)
    btn.classList.toggle('badge-pick-active', on)
  })

  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'block'
  document.getElementById('badgePickerSheet')?.classList.add('open')
  history.pushState({ v: 'badge' }, '')
}

export function closeBadgePicker() {
  document.getElementById('badgePickerSheet')?.classList.remove('open')
  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'none'
  _cardId = null
  if (history.state?.v === 'badge') history.back()
}

export function initBadgePicker() {
  document.querySelectorAll('#badgePickerSheet [data-badge]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!_cardId) return
      const card = state.ALL_CARDS.find(c => c.id === _cardId)
      if (!card) return
      const key = btn.dataset.badge
      const newVal = !isOn(card, key)
      const updates = { [key]: newVal }
      // Match the card-detail Sleevd toggle: marking a card sleevd offers a
      // price prompt too, whichever surface you do it from.
      if (key === 'Owned' && newVal && (card.Sold === true || card.Sold === 'true')) {
        // Re-sleeving a sold card means it's back in hand: clear the sale
        Object.assign(updates, { Sold: false, SoldPrice: '', SoldDate: '' })
      } else if (key === 'Owned' && newVal) {
        const price = await promptPrice()
        if (price !== null) updates.Price = String(price)
      }
      btn.classList.toggle('badge-pick-active', newVal)
      await setDoc(doc(db, 'Cards', _cardId), updates, { merge: true })
    })
  })
}
