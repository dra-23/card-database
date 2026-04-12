import { db, doc, setDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import * as state from '../state.js'
import { isOwned } from '../utils.js'
import { renderCardPanelInto } from './card-detail.js'
import { openCardForm } from './card-form.js'

let _activeCardId = null

export function createOverflowMenu() {
  const popup = document.createElement('div')
  popup.id = 'overflowMenuPopup'
  popup.className = 'overflow-menu-popup'
  popup.innerHTML = `
    <button class="overflow-menu-item" id="omEdit">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      Edit
    </button>
    <button class="overflow-menu-item" id="omChangeImage">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
      Change Image
    </button>
    <button class="overflow-menu-item" id="omToggleOwned">
      <svg id="omToggleIcon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"></svg>
      <span id="omOwnedLabel">Mark Unsleevd</span>
    </button>
  `
  document.body.appendChild(popup)

  const imgInput = document.createElement('input')
  imgInput.type = 'file'; imgInput.accept = 'image/*'; imgInput.style.display = 'none'; imgInput.id = 'omImageInput'
  document.body.appendChild(imgInput)

  document.getElementById('omEdit').addEventListener('click', () => {
    closeMenu(); openCardForm(_activeCardId)
  })

  document.getElementById('omChangeImage').addEventListener('click', () => {
    closeMenu(); imgInput.value = ''; imgInput.click()
  })
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0]
    if (!file || !_activeCardId) return
    const storageRef = ref(storage, `cards/${Date.now()}_${file.name}`)
    const snapshot   = await uploadBytes(storageRef, file)
    const url        = await getDownloadURL(snapshot.ref)
    await setDoc(doc(db, 'Cards', _activeCardId), { 'App Image': url }, { merge: true })
    // Refresh open panel if needed
    if (_activeCardId === state.currentCardId) {
      const panelIds = { player: 'cardDetailPanel', collection: 'collectionCardPanel', graded: 'gradedCardPanel' }
      const panel = document.getElementById(panelIds[state.activeCardContext])
      if (panel) renderCardPanelInto(panel, _activeCardId, state.activeCardContext)
    }
  })

  document.getElementById('omToggleOwned').addEventListener('click', async () => {
    const id = _activeCardId; closeMenu()
    const c = state.ALL_CARDS.find(x => x.id === id); if (!c) return
    await setDoc(doc(db, 'Cards', id), { Owned: !isOwned(c) }, { merge: true })
  })

  document.addEventListener('pointerdown', e => {
    if (popup.classList.contains('open') && !popup.contains(e.target)) closeMenu()
  })
}

function closeMenu() {
  document.getElementById('overflowMenuPopup')?.classList.remove('open')
}

export function openRowMenu(cardId, anchorBtn, clientX, clientY) {
  _activeCardId = cardId
  const c       = state.ALL_CARDS.find(x => x.id === cardId)
  const owned   = c && isOwned(c)
  const toggleBtn   = document.getElementById('omToggleOwned')
  const toggleIcon  = document.getElementById('omToggleIcon')
  const toggleLabel = document.getElementById('omOwnedLabel')

  if (owned) {
    toggleBtn.className = 'overflow-menu-item destructive'
    toggleIcon.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>'
    toggleLabel.textContent = 'Mark Unsleevd'
  } else {
    toggleBtn.className = 'overflow-menu-item sleevd-action'
    toggleIcon.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>'
    toggleLabel.textContent = 'Mark Sleevd'
  }

  const popup = document.getElementById('overflowMenuPopup')
  const popupW = 220
  let left, top

  if (clientX !== undefined && clientX !== null) {
    left = Math.min(clientX - 10, window.innerWidth - popupW - 8)
    if (left < 8) left = 8
    top = clientY + 8
    if (top + 200 > window.innerHeight) top = clientY - 200
  } else if (anchorBtn) {
    const rect = anchorBtn.getBoundingClientRect()
    left = rect.right - popupW; if (left < 8) left = 8
    top  = rect.bottom + 6;    if (top + 190 > window.innerHeight) top = rect.top - 190
  } else {
    left = window.innerWidth / 2 - popupW / 2; top = window.innerHeight / 2 - 80
  }

  popup.style.left = left + 'px'
  popup.style.top  = top  + 'px'
  popup.classList.add('open')
}
