import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'

const BADGES = [
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
    const on = card[key] === true || card[key] === 'true'
    btn.classList.toggle('badge-pick-active', on)
  })

  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'block'
  document.getElementById('badgePickerSheet')?.classList.add('open')
}

export function closeBadgePicker() {
  document.getElementById('badgePickerSheet')?.classList.remove('open')
  const scrim = document.getElementById('globalScrim')
  if (scrim) scrim.style.display = 'none'
  _cardId = null
}

export function initBadgePicker() {
  document.querySelectorAll('#badgePickerSheet [data-badge]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!_cardId) return
      const card = state.ALL_CARDS.find(c => c.id === _cardId)
      if (!card) return
      const key = btn.dataset.badge
      const newVal = !(card[key] === true || card[key] === 'true')
      btn.classList.toggle('badge-pick-active', newVal)
      await setDoc(doc(db, 'Cards', _cardId), { [key]: newVal }, { merge: true })
    })
  })
}
