import { db, doc, setDoc, addDoc, collection, deleteField, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import { auth } from '../firebase.js'
import * as state from '../state.js'
import { isOwned } from '../utils.js'
import { closeAllForms } from '../gestures.js'

// ── Grade dropdown init ────────────────────────────────────────────────────
export function initGradeDropdown() {
  const sel = document.getElementById('f_grade')
  if (!sel) return
  let html = '<option value="N/A">N/A</option>'
  for (let i = 10; i >= 1; i -= 0.5) {
    const val = Number.isInteger(i) ? String(i) : i.toFixed(1)
    html += `<option value="${val}">${val}</option>`
  }
  sel.innerHTML = html
}

// ── Toggle badge flag buttons ──────────────────────────────────────────────
const FLAG_STYLES = {
  rc:       { hidden: 'f_rc',       btn: 'f_rc_btn',       bg: 'rgba(232,25,44,0.08)',  border: '#E8192C', color: '#E8192C' },
  auto:     { hidden: 'f_auto',     btn: 'f_auto_btn',     bg: 'rgba(184,134,11,0.10)', border: '#B8860B', color: '#B8860B' },
  mem:      { hidden: 'f_mem',      btn: 'f_mem_btn',      bg: 'rgba(21,101,192,0.08)', border: '#1565C0', color: '#1565C0' },
  numbered: { hidden: 'f_numbered', btn: 'f_numbered_btn', bg: 'rgba(96,125,139,0.10)', border: '#607D8B', color: '#607D8B' },
}
export function setFormFlag(flag, active) {
  const cfg = FLAG_STYLES[flag]; if (!cfg) return
  const hidden = document.getElementById(cfg.hidden)
  const btn    = document.getElementById(cfg.btn)
  if (!hidden || !btn) return
  hidden.value = active ? 'true' : 'false'
  if (active) {
    btn.style.background  = cfg.bg
    btn.style.borderColor = cfg.border
    btn.style.color       = cfg.color
  } else {
    btn.style.background  = 'transparent'
    btn.style.borderColor = 'var(--md-outline)'
    btn.style.color       = 'var(--md-on-surface)'
  }
}

// ── Open card form (add or edit) ───────────────────────────────────────────
export function openCardForm(cardId = null, formCtx = null) {
  const ctx = formCtx || (state.selectedPlayer ? 'player' : 'collection')
  let contextPlayer = null
  if (cardId) {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (c) contextPlayer = state.ALL_PLAYERS.find(p => p.id === c.Player)
  } else if (ctx === 'player') {
    contextPlayer = state.selectedPlayer
  }

  const isEdit = !!cardId
  document.getElementById('cardFormTitle').innerText = isEdit ? 'Edit Card' : 'Add Card'
  document.getElementById('f_cardId').value = cardId || ''

  const saveBtn = document.getElementById('btnSaveCard')
  saveBtn.disabled = false
  saveBtn.innerText = isEdit ? 'Save Card' : 'Mark Sleevd'

  // Populate player dropdown
  const playerSel   = document.getElementById('f_player')
  const sortedPlayers = [...state.ALL_PLAYERS].sort((a, b) => (a.Player || a.id).localeCompare(b.Player || b.id))
  const blankOpt    = ctx === 'collection' && !isEdit ? '<option value="">Select player...</option>' : ''
  playerSel.innerHTML = blankOpt + sortedPlayers.map(p => `<option value="${p.id}">${p.Player || p.id}</option>`).join('')

  if (ctx === 'player' && contextPlayer) {
    playerSel.value = contextPlayer.id
    playerSel.disabled = true
    document.getElementById('f_player_field').classList.add('read-only')
  } else if (isEdit && contextPlayer) {
    playerSel.value = contextPlayer.id
    playerSel.disabled = false
    document.getElementById('f_player_field').classList.remove('read-only')
  } else {
    playerSel.value = ''
    playerSel.disabled = false
    document.getElementById('f_player_field').classList.remove('read-only')
  }

  function refreshTeams() {
    const pid   = playerSel.value
    const teams = [...new Set(state.ALL_CARDS.filter(c => c.Player === pid).map(c => c.Team).filter(Boolean))]
    document.getElementById('f_team').innerHTML =
      teams.map(t => `<option value="${t}">${t}</option>`).join('') + '<option value="">(New Team...)</option>'
  }
  playerSel.onchange = refreshTeams
  refreshTeams()

  if (isEdit) {
    const c = state.ALL_CARDS.find(x => x.id === cardId)
    if (!c) return
    document.getElementById('f_year').value         = c.Year || ''
    document.getElementById('f_set').value          = c.Set || ''
    document.getElementById('f_number').value       = c.Number || ''
    document.getElementById('f_manufacturer').value = c.Manufacturer || ''
    document.getElementById('f_sport').value        = c.Sport || ''
    document.getElementById('f_team').value         = c.Team || ''
    document.getElementById('f_grading').value      = c['Grading Company'] || 'Raw'
    document.getElementById('f_grade').value        = c.Grade || 'N/A'
    document.getElementById('f_price').value        = c.Price || ''
    document.getElementById('f_url').value          = c['Card Information'] || ''
    setFormFlag('rc',       c.RC       === true || c.RC       === 'true')
    setFormFlag('auto',     c.Auto     === true || c.Auto     === 'true')
    setFormFlag('mem',      c.Mem === true || c.Mem === 'true' || c.Patch === true || c.Patch === 'true')
    setFormFlag('numbered', c.Numbered === true || c.Numbered === 'true')
    if (c['App Image']) {
      document.getElementById('f_imagePreview').src   = c['App Image']
      document.getElementById('f_imagePreview').style.display     = 'block'
      document.getElementById('previewPlaceholder').style.display = 'none'
    }
  } else {
    ;['f_year','f_set','f_number','f_manufacturer','f_price','f_url'].forEach(id => { document.getElementById(id).value = '' })
    document.getElementById('f_sport').value   = (ctx === 'player' && contextPlayer) ? (contextPlayer.Sport || '') : ''
    document.getElementById('f_grading').value = 'Raw'
    document.getElementById('f_grade').value   = 'N/A'
    setFormFlag('rc', false); setFormFlag('auto', false)
    setFormFlag('mem', false); setFormFlag('numbered', false)
    document.getElementById('f_imagePreview').style.display     = 'none'
    document.getElementById('previewPlaceholder').style.display = 'block'
    document.getElementById('f_fileInput').value = ''
  }

  const sheet = document.getElementById('cardFormSheet')
  sheet.classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.zIndex = '1150'
  scrim.style.display = 'block'
}

// ── Save card ──────────────────────────────────────────────────────────────
export async function saveCard() {
  const btn = document.getElementById('btnSaveCard')
  btn.disabled = true; btn.innerText = 'Saving…'

  try {
    const id   = document.getElementById('f_cardId').value
    const file = document.getElementById('f_fileInput').files[0]
    let imageUrl = id ? (state.ALL_CARDS.find(x => x.id === id)?.['App Image'] || '') : ''

    if (file) {
      // Force-refresh the auth token — a stale token causes storage/unauthorized
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken(true)
        console.log('[upload] uid:', auth.currentUser.uid, 'token prefix:', token.slice(0, 20))
      } else {
        console.warn('[upload] no currentUser — storage will be unauthorized')
      }
      const storageRef = ref(storage, `cards/${Date.now()}_${file.name}`)
      console.log('[upload] attempting upload to:', storageRef.fullPath)
      const snapshot   = await uploadBytes(storageRef, file)
      imageUrl         = await getDownloadURL(snapshot.ref)
      console.log('[upload] success, url:', imageUrl.slice(0, 60))
    }

    const playerId = document.getElementById('f_player').value
    const cardData = {
      Player:           playerId,
      Year:             document.getElementById('f_year').value,
      Set:              document.getElementById('f_set').value,
      Number:           document.getElementById('f_number').value,
      Manufacturer:     document.getElementById('f_manufacturer').value,
      Sport:            document.getElementById('f_sport').value,
      Team:             document.getElementById('f_team').value,
      'Grading Company': document.getElementById('f_grading').value,
      Grade:            document.getElementById('f_grade').value,
      Price:            document.getElementById('f_price').value,
      'Card Information': document.getElementById('f_url').value,
      'App Image':      imageUrl,
      RC:       document.getElementById('f_rc').value       === 'true',
      Auto:     document.getElementById('f_auto').value     === 'true',
      Mem:      document.getElementById('f_mem').value      === 'true',
      Numbered: document.getElementById('f_numbered').value === 'true',
      Owned: id ? state.ALL_CARDS.find(x => x.id === id)?.Owned : true,
    }

    // deleteField() is only valid in setDoc/updateDoc, not addDoc
    if (id) cardData.Patch = deleteField()

    if (id) await setDoc(doc(db, 'Cards', id), cardData, { merge: true })
    else    await addDoc(collection(db, 'Cards'), cardData)

    closeAllForms()
  } catch (e) {
    console.error('saveCard error:', e)
    btn.disabled = false
    btn.innerText = '⚠ ' + (e?.code || e?.message || 'Save failed')
  }
}

// ── File preview ───────────────────────────────────────────────────────────
export function handleFileSelect(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('f_imagePreview').src           = e.target.result
    document.getElementById('f_imagePreview').style.display = 'block'
    document.getElementById('previewPlaceholder').style.display = 'none'
  }
  reader.readAsDataURL(file)
}
