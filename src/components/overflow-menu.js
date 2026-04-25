import { db, doc, setDoc, deleteDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import * as state from '../state.js'
import { isOwned } from '../utils.js'
import { promptPrice } from './price-prompt.js'
import { renderCardPanelInto } from './card-detail.js'
import { openCardForm } from './card-form.js'
import { cardsight } from '../cardsight.js'

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
    <button class="overflow-menu-item" id="omFindMarketValue">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
      Find Market Value
    </button>
    <div style="height:1px; background:var(--md-outline); opacity:0.12; margin:4px 0;"></div>
    <button class="overflow-menu-item destructive" id="omDelete">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      Delete Card
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
    const markingSleevd = !isOwned(c)
    const updates = { Owned: markingSleevd }
    if (markingSleevd) {
      const price = await promptPrice()
      if (price !== null) updates.Price = String(price)
    }
    await setDoc(doc(db, 'Cards', id), updates, { merge: true })
  })

  document.getElementById('omFindMarketValue').addEventListener('click', async () => {
    const id = _activeCardId; closeMenu()
    const c = state.ALL_CARDS.find(x => x.id === id); if (!c) return
    const player = state.ALL_PLAYERS.find(p => p.id === c.Player)
    const playerName = player ? (player.Player || player.id) : (c.Player || '')
    const num = c.Number ? `#${c.Number}` : ''

    // Find the visible market value cell to give live feedback
    const panelCandidates = ['twoPane-panel','twoPane-coll-panel','twoPane-grad-panel','cardDetailPanel','collectionCardPanel','gradedCardPanel']
    let targetPanel = null
    for (const pid of panelCandidates) {
      const p = document.getElementById(pid)
      if (p?.querySelector('[data-mv-value]')) { targetPanel = p; break }
    }
    const valEl = targetPanel?.querySelector('[data-mv-value]')
    if (valEl) valEl.textContent = 'Searching…'

    const seen = new Set()
    const queries = [
      [playerName, c.Year, c.Set,          num],
      [playerName, c.Year, c.Manufacturer, num],
      [playerName, c.Year,                 num],
      [playerName,         c.Manufacturer, num],
      [playerName,         c.Set,          num],
      [playerName,                         num],
    ]
      .map(parts => parts.filter(Boolean).join(' ').trim())
      .filter(q => q && !seen.has(q) && seen.add(q))

    console.log('[FindMarketValue] card:', { playerName, year: c.Year, set: c.Set, manufacturer: c.Manufacturer, number: c.Number })
    console.log('[FindMarketValue] queries to try:', queries)

    try {
      let cardsightId = null
      for (const q of queries) {
        const { data, error } = await cardsight.catalog.search({ q, type: 'card', take: 5 })
        console.log(`[FindMarketValue] q="${q}" →`, error ? `error: ${error}` : `${data?.results?.length ?? 0} results`)
        if (!error && data?.results?.length) {
          cardsightId = data.results[0].id
          console.log('[FindMarketValue] matched id:', cardsightId, 'name:', data.results[0].name)
          break
        }
      }
      if (!cardsightId) {
        console.warn('[FindMarketValue] no match found across all queries')
        if (valEl && document.contains(valEl)) valEl.textContent = 'Not found'
        return
      }
      await setDoc(doc(db, 'Cards', id), { CardsightId: cardsightId }, { merge: true })
    } catch (e) {
      console.error('[FindMarketValue] error:', e)
      if (valEl && document.contains(valEl)) valEl.textContent = 'Error'
    }
  })

  document.getElementById('omDelete').addEventListener('click', () => {
    const id = _activeCardId
    closeMenu()
    showDeleteConfirm(id)
  })

  document.addEventListener('pointerdown', e => {
    if (popup.classList.contains('open') && !popup.contains(e.target)) closeMenu()
  })
}

function showDeleteConfirm(cardId) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;'
  overlay.innerHTML = `
    <div style="background:var(--md-surface);border-radius:28px;padding:24px;width:100%;max-width:320px;">
      <div style="font-size:18px;font-weight:700;font-family:'Google Sans Display';margin-bottom:8px;">Delete Card?</div>
      <div style="font-size:14px;color:var(--md-on-surface-variant);margin-bottom:24px;line-height:1.5;">This card will be permanently deleted and cannot be undone.</div>
      <div style="display:flex;gap:12px;">
        <button id="_delCancel" style="flex:1;height:48px;border:none;border-radius:24px;background:var(--md-surface-2);font-family:'Google Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;color:var(--md-on-surface);">Cancel</button>
        <button id="_delConfirm" style="flex:1;height:48px;border:none;border-radius:24px;background:#C62828;color:#fff;font-family:'Google Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;">Delete</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.querySelector('#_delCancel').onclick  = () => overlay.remove()
  overlay.querySelector('#_delConfirm').onclick = async () => {
    overlay.remove()
    try {
      // Close card sheet if the deleted card is currently open
      if (cardId === state.currentCardId) {
        window._closeCardSheet?.(state.activeCardContext)
      }
      await deleteDoc(doc(db, 'Cards', cardId))
    } catch (e) {
      console.error('deleteCard error:', e)
    }
  }
  // Tap outside to cancel
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) overlay.remove() })
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
