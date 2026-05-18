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
  sheet.className = 'sheet'
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" style="gap:0;">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
        <img id="peThumb" style="width:56px; height:78px; border-radius:12px; object-fit:cover; background:var(--md-surface-2); flex-shrink:0;">
        <div style="flex:1;">
          <div id="peName" style="font-family:'Google Sans Display'; font-size:20px; font-weight:700;"></div>
          <div id="peCount" style="font-size:12px; opacity:0.6; margin-top:2px;"></div>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="m3-field"><label class="m3-label">Player Name</label><input type="text" id="pe_name" class="m3-input"></div>
        <div class="m3-field"><label class="m3-label">Default Sport</label>
          <select id="pe_sport" class="m3-select">
            <option value="Baseball">Baseball</option>
            <option value="Basketball">Basketball</option>
            <option value="Football">Football</option>
            <option value="Hockey">Hockey</option>
            <option value="Golf">Golf</option>
            <option value="Soccer">Soccer</option>
          </select>
        </div>
        <div style="display:flex; gap:10px;">
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; align-items:center;">
            <div style="width:64px; height:88px; border-radius:10px; overflow:hidden; background:var(--md-surface-2); border:1px dashed var(--md-outline); flex-shrink:0;">
              <img id="peMainPreview" style="width:100%; height:100%; object-fit:cover; display:none;">
              <span id="peMainPlaceholder" style="display:flex; align-items:center; justify-content:center; height:100%; font-size:9px; color:var(--md-outline); text-align:center; padding:4px; line-height:1.3;">Player<br>Photo</span>
            </div>
            <input type="file" id="peMainFileInput" accept="image/*" style="display:none;">
            <button type="button" class="expressive-btn" id="peSelectMainBtn" style="background:var(--md-surface-1); color:var(--md-on-surface); box-shadow:none; height:36px; border-radius:18px; font-size:12px; width:100%; padding:0 12px;">Change Photo</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; align-items:center;">
            <div style="width:64px; height:88px; border-radius:10px; overflow:hidden; background:var(--md-surface-2); border:1px dashed var(--md-outline); flex-shrink:0;">
              <img id="peBannerPreview" style="width:100%; height:100%; object-fit:cover; display:none;">
              <span id="peBannerPlaceholder" style="display:flex; align-items:center; justify-content:center; height:100%; font-size:9px; color:var(--md-outline); text-align:center; padding:4px; line-height:1.3;">Banner<br>Photo</span>
            </div>
            <input type="file" id="peBannerFileInput" accept="image/*" style="display:none;">
            <button type="button" class="expressive-btn" id="peSelectBannerBtn" style="background:var(--md-surface-1); color:var(--md-on-surface); box-shadow:none; height:36px; border-radius:18px; font-size:12px; width:100%; padding:0 12px;">Change Banner</button>
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button id="peDeleteBtn" class="expressive-btn" style="background:rgba(239,83,80,0.08); color:var(--soft-red); box-shadow:none; flex:0 0 auto; width:auto; padding:0 24px; height:52px; border-radius:26px;">Delete</button>
          <button id="peSaveBtn"   class="expressive-btn" style="background:var(--md-primary); color:#fff; flex:1; height:52px; border-radius:26px;">Save</button>
        </div>
      </div>
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
