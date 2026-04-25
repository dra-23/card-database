import { db, doc, setDoc, deleteDoc } from '../firebase.js'
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

export async function savePlayer() {
  const name = document.getElementById('pf_name').value.trim()
  if (!name) return
  await setDoc(doc(db, 'Players', name), {
    Player: name,
    Sport: document.getElementById('pf_sport').value,
    'Main Image': document.getElementById('pf_mainImg').value,
    'Banner_Image': document.getElementById('pf_bannerImg').value,
  })
  ;['pf_name','pf_mainImg','pf_bannerImg'].forEach(id => { document.getElementById(id).value = '' })
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
        <img id="peThumb" style="width:56px; height:78px; border-radius:12px; object-fit:cover; background:#eee; flex-shrink:0;">
        <div>
          <div id="peName" style="font-family:'Google Sans Display'; font-size:20px; font-weight:700;"></div>
          <div id="peCount" style="font-size:12px; opacity:0.6; margin-top:2px;"></div>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="m3-field"><label class="m3-label">Player Name</label><input type="text" id="pe_name" class="m3-input"></div>
        <div class="m3-field"><label class="m3-label">Main Image URL</label><input type="text" id="pe_mainImg" class="m3-input"></div>
        <div class="m3-field"><label class="m3-label">Banner Image URL</label><input type="text" id="pe_bannerImg" class="m3-input"></div>
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
}

export function openPlayerEditMenu(playerId) {
  const p = state.ALL_PLAYERS.find(x => x.id === playerId)
  if (!p) return
  _editPlayerId = playerId
  const pC = state.ALL_CARDS.filter(c => c.Player === playerId)

  document.getElementById('peThumb').src      = getCleanImg(p['Main Image'])
  document.getElementById('peName').innerText = p.Player || p.id
  document.getElementById('peCount').innerText = `${pC.filter(c => c.Owned === true || c.Owned === 'true').length} owned · ${pC.length} total`
  document.getElementById('pe_name').value    = p.Player || p.id
  document.getElementById('pe_mainImg').value = p['Main Image'] || ''
  document.getElementById('pe_bannerImg').value = p['Banner_Image'] || ''
  document.getElementById('pe_sport').value   = p.Sport || 'Baseball'

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
  await setDoc(doc(db, 'Players', _editPlayerId), {
    Player: newName,
    Sport:  document.getElementById('pe_sport').value,
    'Main Image':    document.getElementById('pe_mainImg').value,
    'Banner_Image':  document.getElementById('pe_bannerImg').value,
  }, { merge: true })
  closePlayerEdit()
}

async function deletePlayer() {
  if (!_editPlayerId) return
  if (!confirm(`Delete ${_editPlayerId} and all their cards?`)) return
  await deleteDoc(doc(db, 'Players', _editPlayerId))
  const cards = state.ALL_CARDS.filter(c => c.Player === _editPlayerId)
  await Promise.all(cards.map(c => deleteDoc(doc(db, 'Cards', c.id))))
  closePlayerEdit()
}
