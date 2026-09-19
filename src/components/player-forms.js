import { db, doc, setDoc, deleteDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import * as state from '../state.js'
import { getCleanImg } from '../utils.js'
import { closeAllForms } from '../gestures.js'

// ── New player form ────────────────────────────────────────────────────────
export function openPlayerForm() {
  document.getElementById('playerFormSheet').classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.display = 'block'
  scrim.onclick = () => closeAllForms()
}

export function handlePlayerFileSelect(input, previewId, placeholderId) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    const preview = document.getElementById(previewId)
    const placeholder = document.getElementById(placeholderId)
    if (preview) { preview.src = e.target.result; preview.style.display = 'block' }
    if (placeholder) placeholder.style.display = 'none'
  }
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
  if (!name) return

  const [mainUrl, bannerUrl] = await Promise.all([
    _uploadPlayerImg('pf_mainFileInput', 'main'),
    _uploadPlayerImg('pf_bannerFileInput', 'banner'),
  ])

  const data = { Player: name, Sport: document.getElementById('pf_sport').value }
  if (mainUrl)   data['Main Image']    = mainUrl
  if (bannerUrl) data['Banner_Image']  = bannerUrl

  await setDoc(doc(db, 'Players', name), data)

  document.getElementById('pf_name').value = ''
  ;['pf_mainFileInput','pf_bannerFileInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  ;['pf_mainImgPreview','pf_bannerImgPreview'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none' })
  ;['pf_mainImgPlaceholder','pf_bannerImgPlaceholder'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = '' })
  closeAllForms()
}

// ── Player edit sheet ──────────────────────────────────────────────────────
let _editPlayerId = null

export function createPlayerEditSheet() {
  const sheet = document.createElement('div')
  sheet.id = 'playerEditSheet'
  sheet.className = 'sheet cf2-sheet'
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="cf2-header cf2-header-player">
      <img id="peThumb" class="cf2-header-thumb">
      <div class="cf2-header-info">
        <div id="peName" class="cf2-header-name"></div>
        <div id="peCount" class="cf2-header-count"></div>
      </div>
    </div>
    <div class="cf2-scroll">
      <input type="file" id="peMainFileInput" accept="image/*" style="display:none;">
      <input type="file" id="peBannerFileInput" accept="image/*" style="display:none;">

      <div class="cf2-photo-wrap">
        <div class="cf2-photo" id="peMainPhotoBox">
          <span id="peMainPlaceholder" class="cf2-photo-placeholder">No Photo</span>
          <img id="peMainPreview" class="cf2-photo-img" style="display:none;">
          <button type="button" class="cf2-photo-btn" id="peSelectMainBtn">📷 Change Photo</button>
        </div>
      </div>

      <div class="cf2-field">
        <label class="cf2-label">Player Name</label>
        <input type="text" id="pe_name" class="cf2-input">
      </div>
      <div class="cf2-field">
        <label class="cf2-label">Default Sport</label>
        <select id="pe_sport" class="cf2-select">
          <option value="Baseball">Baseball</option>
          <option value="Basketball">Basketball</option>
          <option value="Football">Football</option>
          <option value="Hockey">Hockey</option>
          <option value="Golf">Golf</option>
          <option value="Soccer">Soccer</option>
        </select>
      </div>
      <div class="cf2-field">
        <label class="cf2-label">Banner Photo</label>
        <div class="cf2-photo cf2-photo-banner" id="peBannerPhotoBox">
          <span id="peBannerPlaceholder" class="cf2-photo-placeholder">No Banner</span>
          <img id="peBannerPreview" class="cf2-photo-img" style="display:none;">
          <button type="button" class="cf2-photo-btn" id="peSelectBannerBtn">📷 Change Banner</button>
        </div>
      </div>
    </div>

    <div class="cf2-footer">
      <button id="peDeleteBtn" class="cf2-btn cf2-btn-delete">Delete</button>
      <button id="peSaveBtn"   class="cf2-btn cf2-btn-primary">Save</button>
    </div>
  `
  document.body.appendChild(sheet)

  document.getElementById('peSaveBtn').addEventListener('click', savePlayerEdit)
  document.getElementById('peDeleteBtn').addEventListener('click', deletePlayer)
  document.getElementById('peSelectMainBtn').addEventListener('click', () => document.getElementById('peMainFileInput').click())
  document.getElementById('peSelectBannerBtn').addEventListener('click', () => document.getElementById('peBannerFileInput').click())
  document.getElementById('peMainFileInput').addEventListener('change', e => {
    handlePlayerFileSelect(e.target, 'peMainPreview', 'peMainPlaceholder')
  })
  document.getElementById('peBannerFileInput').addEventListener('change', e => {
    handlePlayerFileSelect(e.target, 'peBannerPreview', 'peBannerPlaceholder')
  })
}

export function openPlayerEditMenu(playerId) {
  const p = state.ALL_PLAYERS.find(x => x.id === playerId)
  if (!p) return
  _editPlayerId = playerId
  const pC = state.ALL_CARDS.filter(c => c.Player === playerId)

  // Header
  document.getElementById('peThumb').src       = getCleanImg(p['Main Image'])
  document.getElementById('peName').innerText  = p.Player || p.id
  document.getElementById('peCount').innerText = `${pC.filter(c => c.Owned === true || c.Owned === 'true').length} owned · ${pC.length} total`
  document.getElementById('pe_name').value     = p.Player || p.id
  document.getElementById('pe_sport').value    = p.Sport || 'Baseball'

  // Photo previews — show existing images
  const mainImg   = getCleanImg(p['Main Image'])
  const bannerImg = getCleanImg(p['Banner_Image'])
  const mainPrev  = document.getElementById('peMainPreview')
  const bannerPrev = document.getElementById('peBannerPreview')
  if (mainImg)   { mainPrev.src = mainImg;     mainPrev.style.display = 'block'; document.getElementById('peMainPlaceholder').style.display = 'none' }
  else           { mainPrev.style.display = 'none'; document.getElementById('peMainPlaceholder').style.display = 'flex' }
  if (bannerImg) { bannerPrev.src = bannerImg; bannerPrev.style.display = 'block'; document.getElementById('peBannerPlaceholder').style.display = 'none' }
  else           { bannerPrev.style.display = 'none'; document.getElementById('peBannerPlaceholder').style.display = 'flex' }

  // Clear file inputs from prior open
  ;['peMainFileInput','peBannerFileInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })

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
  if (!newName) return

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
      'Main Image':   mainUrl   || p?.['Main Image']   || '',
      'Banner_Image': bannerUrl || p?.['Banner_Image'] || '',
    }
    await setDoc(doc(db, 'Players', _editPlayerId), data, { merge: true })
    closePlayerEdit()
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save' }
  }
}

async function deletePlayer() {
  if (!_editPlayerId) return
  if (!confirm(`Delete ${_editPlayerId} and all their cards?`)) return
  await deleteDoc(doc(db, 'Players', _editPlayerId))
  const cards = state.ALL_CARDS.filter(c => c.Player === _editPlayerId)
  await Promise.all(cards.map(c => deleteDoc(doc(db, 'Cards', c.id))))
  closePlayerEdit()
}
