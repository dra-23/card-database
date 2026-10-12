import { db, doc, setDoc, deleteDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import * as state from '../state.js'
import { getCleanImg, isOwned, syncChoice, sportChipsHTML, confirmDialog } from '../utils.js'
import { closeAllForms } from '../gestures.js'

// Both player forms show a live preview of the player page header: the
// banner with the player photo overlapping it, each tappable to change.

function _setPreview(previewId, placeholderId, url) {
  const preview = document.getElementById(previewId)
  const placeholder = document.getElementById(placeholderId)
  if (preview) { preview.src = url || ''; preview.style.display = url ? 'block' : 'none' }
  if (placeholder) placeholder.style.display = url ? 'none' : ''
}

function _showError(fieldId, show) {
  document.getElementById(fieldId)?.classList.toggle('has-error', show)
}

// ── New player form ────────────────────────────────────────────────────────
export function openPlayerForm() {
  // Always start clean
  document.getElementById('pf_name').value = ''
  _showError('pf_name_field', false)
  document.getElementById('pf_sport').value = 'Baseball'
  syncChoice('pf_sport')
  ;['pf_mainFileInput', 'pf_bannerFileInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  _setPreview('pf_mainImgPreview', 'pf_mainImgPlaceholder', '')
  _setPreview('pf_bannerImgPreview', 'pf_bannerImgPlaceholder', '')
  const btn = document.getElementById('btnSavePlayer')
  if (btn) { btn.disabled = false; btn.textContent = 'Add player' }

  document.getElementById('playerFormSheet').classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.display = 'block'
  scrim.onclick = () => closeAllForms()
}

export function handlePlayerFileSelect(input, previewId, placeholderId) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => _setPreview(previewId, placeholderId, e.target.result)
  reader.readAsDataURL(file)
}

async function _uploadPlayerImg(inputId, folder) {
  const file = document.getElementById(inputId)?.files[0]
  if (!file) return null
  const storageRef = ref(storage, `players/${folder}_${Date.now()}_${file.name}`)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

export async function savePlayer() {
  const name = document.getElementById('pf_name').value.trim()
  if (!name) {
    _showError('pf_name_field', true)
    document.getElementById('pf_name').focus()
    return
  }

  const btn = document.getElementById('btnSavePlayer')
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…' }
  try {
    const [mainUrl, bannerUrl] = await Promise.all([
      _uploadPlayerImg('pf_mainFileInput', 'main'),
      _uploadPlayerImg('pf_bannerFileInput', 'banner'),
    ])
    const data = { Player: name, Sport: document.getElementById('pf_sport').value }
    if (mainUrl)   data['Main Image']   = mainUrl
    if (bannerUrl) data['Banner_Image'] = bannerUrl
    await setDoc(doc(db, 'Players', name), data)
    closeAllForms()
  } catch (e) {
    console.error('savePlayer error:', e)
    if (btn) btn.textContent = `Couldn't save. Try again`
    return
  } finally {
    if (btn) btn.disabled = false
  }
  if (btn) btn.textContent = 'Add player'
}

// ── Player edit sheet ──────────────────────────────────────────────────────
let _editPlayerId = null
let _pickedMainUrl = null // a card image chosen as the player photo (no upload needed)

// This player's card images, owned cards first, de-duplicated
function _playerCardImages(playerId) {
  const seen = new Set()
  return state.ALL_CARDS
    .filter(c => c.Player === playerId)
    .sort((a, b) => Number(isOwned(b)) - Number(isOwned(a)))
    .map(c => ({ url: c.PSAImage || getCleanImg(c['App Image']), label: [c.Year, c.Set].filter(Boolean).join(' ') + (c.Number ? ` #${c.Number}` : '') }))
    .filter(x => x.url && !seen.has(x.url) && seen.add(x.url))
}

function _openCardImagePicker() {
  const images = _playerCardImages(_editPlayerId)
  if (!images.length) return
  const overlay = document.createElement('div')
  overlay.className = 'picker-overlay'
  overlay.innerHTML = `
    <div class="picker-box" role="dialog" aria-modal="true" aria-label="Pick a card image">
      <div class="picker-head">
        <div class="picker-title">Pick a card image</div>
        <button type="button" class="cf2-close picker-close" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="picker-grid"></div>
    </div>`
  const grid = overlay.querySelector('.picker-grid')
  images.forEach(({ url, label }) => {
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = 'picker-tile'
    tile.title = label
    const img = document.createElement('img')
    img.loading = 'lazy'
    img.alt = label
    img.onerror = () => tile.remove() // skip images that no longer load
    img.src = url
    tile.appendChild(img)
    tile.addEventListener('click', () => {
      _pickedMainUrl = url
      document.getElementById('peMainFileInput').value = ''
      _setPreview('peMainPreview', 'peMainPlaceholder', url)
      overlay.remove()
    })
    grid.appendChild(tile)
  })
  overlay.querySelector('.picker-close').onclick = () => overlay.remove()
  overlay.addEventListener('pointerdown', e => { if (e.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}

export function createPlayerEditSheet() {
  const sheet = document.createElement('div')
  sheet.id = 'playerEditSheet'
  sheet.className = 'sheet cf2-sheet'
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="cf2-header">
      <div class="cf2-titles">
        <h2>Edit player</h2>
        <p class="cf2-sub" id="peCount"></p>
      </div>
      <button type="button" class="cf2-close" id="peCloseBtn" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="cf2-scroll">
      <input type="file" id="peMainFileInput" accept="image/*" style="display:none;">
      <input type="file" id="peBannerFileInput" accept="image/*" style="display:none;">

      <div class="cf2-page-preview">
        <button type="button" class="cf2-banner" id="peSelectBannerBtn" aria-label="Change banner photo">
          <img id="peBannerPreview" class="cf2-photo-img" style="display:none;" alt="">
          <span id="peBannerPlaceholder" class="cf2-banner-ph">Add a banner photo</span>
          <span class="cf2-cam material-symbols-outlined">photo_camera</span>
        </button>
        <button type="button" class="cf2-avatar" id="peSelectMainBtn" aria-label="Change player photo">
          <img id="peMainPreview" class="cf2-photo-img" style="display:none;" alt="">
          <span id="peMainPlaceholder" class="cf2-avatar-ph material-symbols-outlined">person</span>
          <span class="cf2-cam material-symbols-outlined">photo_camera</span>
        </button>
      </div>

      <button type="button" class="cf2-pick-link" id="pePickFromCards">
        <span class="material-symbols-outlined">style</span>Use one of their card images
      </button>

      <div class="cf2-field" id="pe_name_field">
        <label class="cf2-label" for="pe_name">Player name</label>
        <input type="text" id="pe_name" class="cf2-input" autocomplete="off">
        <span class="cf2-error">Enter a name</span>
      </div>
      <div class="cf2-field">
        <span class="cf2-label">Default sport</span>
        <input type="hidden" id="pe_sport" value="Baseball">
        <div class="cf2-chips" data-choice-for="pe_sport" role="radiogroup" aria-label="Default sport">${sportChipsHTML()}</div>
      </div>

      <button type="button" class="cf2-danger-link" id="peDeleteBtn">
        <span class="material-symbols-outlined">delete</span><span id="peDeleteLabel">Delete player</span>
      </button>
    </div>

    <div class="cf2-footer">
      <button id="peCancelBtn" class="cf2-btn cf2-btn-cancel">Cancel</button>
      <button id="peSaveBtn"   class="cf2-btn cf2-btn-primary">Save changes</button>
    </div>
  `
  document.body.appendChild(sheet)

  document.getElementById('peSaveBtn').addEventListener('click', savePlayerEdit)
  document.getElementById('peDeleteBtn').addEventListener('click', deletePlayer)
  document.getElementById('peCancelBtn').addEventListener('click', closePlayerEdit)
  document.getElementById('peCloseBtn').addEventListener('click', closePlayerEdit)
  document.getElementById('pe_name').addEventListener('input', () => _showError('pe_name_field', false))
  document.getElementById('peSelectMainBtn').addEventListener('click', () => document.getElementById('peMainFileInput').click())
  document.getElementById('peSelectBannerBtn').addEventListener('click', () => document.getElementById('peBannerFileInput').click())
  document.getElementById('peMainFileInput').addEventListener('change', e => {
    _pickedMainUrl = null // an uploaded photo wins over a picked card image
    handlePlayerFileSelect(e.target, 'peMainPreview', 'peMainPlaceholder')
  })
  document.getElementById('pePickFromCards').addEventListener('click', _openCardImagePicker)
  document.getElementById('peBannerFileInput').addEventListener('change', e => {
    handlePlayerFileSelect(e.target, 'peBannerPreview', 'peBannerPlaceholder')
  })
}

export function openPlayerEditMenu(playerId) {
  const p = state.ALL_PLAYERS.find(x => x.id === playerId)
  if (!p) return
  _editPlayerId = playerId
  const pC = state.ALL_CARDS.filter(c => c.Player === playerId)
  const owned = pC.filter(isOwned).length

  document.getElementById('peCount').innerText = `${owned.toLocaleString()} sleevd · ${pC.length.toLocaleString()} ${pC.length === 1 ? 'card' : 'cards'}`
  document.getElementById('pe_name').value = p.Player || p.id
  _showError('pe_name_field', false)
  document.getElementById('pe_sport').value = p.Sport || 'Baseball'
  syncChoice('pe_sport')
  document.getElementById('peDeleteLabel').textContent = pC.length
    ? `Delete player and all ${pC.length.toLocaleString()} ${pC.length === 1 ? 'card' : 'cards'}`
    : 'Delete player'

  _pickedMainUrl = null
  document.getElementById('pePickFromCards').style.display = _playerCardImages(playerId).length ? '' : 'none'
  _setPreview('peMainPreview', 'peMainPlaceholder', getCleanImg(p['Main Image']))
  _setPreview('peBannerPreview', 'peBannerPlaceholder', getCleanImg(p['Banner_Image']))
  ;['peMainFileInput', 'peBannerFileInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const btn = document.getElementById('peSaveBtn')
  if (btn) { btn.disabled = false; btn.textContent = 'Save changes' }
  document.querySelector('#playerEditSheet .cf2-scroll').scrollTop = 0

  const sheet = document.getElementById('playerEditSheet')
  sheet.classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.display = 'block'
  scrim.style.zIndex  = '1150'
  scrim.onclick = () => closePlayerEdit()
}

export function closePlayerEdit() {
  const sheet = document.getElementById('playerEditSheet')
  if (sheet) sheet.classList.remove('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.display = 'none'
  scrim.style.zIndex  = '900'
  scrim.onclick = () => closeAllForms()
}

async function savePlayerEdit() {
  if (!_editPlayerId) return
  const newName = document.getElementById('pe_name').value.trim()
  if (!newName) {
    _showError('pe_name_field', true)
    document.getElementById('pe_name').focus()
    return
  }

  const btn = document.getElementById('peSaveBtn')
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }

  try {
    const [mainUrl, bannerUrl] = await Promise.all([
      _uploadPlayerImg('peMainFileInput', 'main'),
      _uploadPlayerImg('peBannerFileInput', 'banner'),
    ])

    const p = state.ALL_PLAYERS.find(x => x.id === _editPlayerId)
    const data = {
      Player: newName,
      Sport:  document.getElementById('pe_sport').value,
      'Main Image':   mainUrl   || _pickedMainUrl || p?.['Main Image'] || '',
      'Banner_Image': bannerUrl || p?.['Banner_Image'] || '',
    }
    await setDoc(doc(db, 'Players', _editPlayerId), data, { merge: true })
    closePlayerEdit()
    if (btn) btn.textContent = 'Save changes'
  } catch (e) {
    console.error('savePlayerEdit error:', e)
    if (btn) btn.textContent = `Couldn't save. Try again`
  } finally {
    if (btn) btn.disabled = false
  }
}

async function deletePlayer() {
  if (!_editPlayerId) return
  const p = state.ALL_PLAYERS.find(x => x.id === _editPlayerId)
  const name = p?.Player || _editPlayerId
  const cards = state.ALL_CARDS.filter(c => c.Player === _editPlayerId)
  const ok = await confirmDialog({
    title: `Delete ${name}?`,
    body: cards.length
      ? `This permanently deletes ${name} and all ${cards.length.toLocaleString()} of their cards. This can't be undone.`
      : `This permanently deletes ${name}. This can't be undone.`,
    confirmLabel: cards.length ? `Delete ${cards.length.toLocaleString()} ${cards.length === 1 ? 'card' : 'cards'}` : 'Delete',
    requireText: 'DELETE',
  })
  if (!ok) return
  await deleteDoc(doc(db, 'Players', _editPlayerId))
  await Promise.all(cards.map(c => deleteDoc(doc(db, 'Cards', c.id))))
  closePlayerEdit()
}
