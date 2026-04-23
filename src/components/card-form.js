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

// ── Custom suggest dropdown ────────────────────────────────────────────────
function attachSuggest(inputId, listId, rawValues) {
  const input   = document.getElementById(inputId)
  const listEl  = document.getElementById(listId)
  if (!input || !listEl) return

  // Always refresh options; only wire listeners once
  input._suggestOpts = [...new Set(rawValues.filter(Boolean))].sort()
  if (input.dataset.suggestReady) return
  input.dataset.suggestReady = '1'

  function show(q) {
    const opts = input._suggestOpts || []
    const filtered = q
      ? opts.filter(v => v.toLowerCase().includes(q.toLowerCase()))
      : opts
    if (!filtered.length) { listEl.style.display = 'none'; return }
    listEl.innerHTML = filtered.slice(0, 30).map(v =>
      `<div class="field-suggest-item">${v}</div>`
    ).join('')
    listEl.style.display = 'block'
    listEl.querySelectorAll('.field-suggest-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        input.value = item.textContent
        listEl.style.display = 'none'
      })
    })
  }

  input.addEventListener('focus', () => show(input.value))
  input.addEventListener('input', () => show(input.value))
  input.addEventListener('blur',  () => setTimeout(() => { listEl.style.display = 'none' }, 150))
}

// ── Save card ──────────────────────────────────────────────────────────────
let _pendingImageFile = null  // set by card-search when scan image should be uploaded

export function setPendingImageFile(file) { _pendingImageFile = file }

// ── Open card form (add or edit) ───────────────────────────────────────────
export function openCardForm(cardId = null, formCtx = null, prefill = null) {
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

  const unsleevdBtn = document.getElementById('btnMarkUnsleevd')
  if (unsleevdBtn) { unsleevdBtn.style.display = isEdit ? 'none' : ''; unsleevdBtn.disabled = false; unsleevdBtn.innerText = 'Mark Unsleevd' }

  // Custom suggest dropdowns for Set and Manufacturer
  attachSuggest('f_set',          'f_set_suggest',          state.ALL_CARDS.map(c => c.Set))
  attachSuggest('f_manufacturer', 'f_manufacturer_suggest', state.ALL_CARDS.map(c => c.Manufacturer))

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
    document.getElementById('f_fileInput').value = ''
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
    _pendingImageFile = null

    // Apply CardSight prefill if provided
    if (prefill) {
      if (prefill.year)         document.getElementById('f_year').value = prefill.year
      if (prefill.set)          document.getElementById('f_set').value = prefill.set
      if (prefill.manufacturer) document.getElementById('f_manufacturer').value = prefill.manufacturer
      if (prefill.number)       document.getElementById('f_number').value = prefill.number
      if (prefill.sport)        document.getElementById('f_sport').value = prefill.sport
      if (prefill.numbered)     setFormFlag('numbered', true)
      if (prefill.rc)           setFormFlag('rc',   true)
      if (prefill.auto)         setFormFlag('auto', true)
      if (prefill.mem)          setFormFlag('mem',  true)
      if (prefill.gradingCompany) {
        document.getElementById('f_grading').value = prefill.gradingCompany
        if (prefill.grade) document.getElementById('f_grade').value = prefill.grade
      }
      if (prefill.imageFile) {
        _pendingImageFile = prefill.imageFile
        document.getElementById('f_imagePreview').src           = prefill.imagePreview || ''
        document.getElementById('f_imagePreview').style.display = 'block'
        document.getElementById('previewPlaceholder').style.display = 'none'
      }
      if (prefill.playerName) {
        const match = state.ALL_PLAYERS.find(p =>
          (p.Player || '').toLowerCase() === (prefill.playerName || '').toLowerCase()
        )
        if (match) { playerSel.value = match.id; refreshTeams() }
      }
      if (prefill.team) {
        const teamSel = document.getElementById('f_team')
        teamSel.value = prefill.team
        if (!teamSel.value) {
          const opt = document.createElement('option')
          opt.value = prefill.team
          opt.textContent = prefill.team
          teamSel.insertBefore(opt, teamSel.firstChild)
          teamSel.value = prefill.team
        }
      }
    }
  }

  const sheet = document.getElementById('cardFormSheet')
  sheet.classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.zIndex = '1150'
  scrim.style.display = 'block'
}

// ── Save card ──────────────────────────────────────────────────────────────
let _saving = false

export async function saveCard(owned = true) {
  if (_saving) return
  _saving = true

  const saveBtn     = document.getElementById('btnSaveCard')
  const unsleevdBtn = document.getElementById('btnMarkUnsleevd')
  if (saveBtn)    { saveBtn.disabled = true;    saveBtn.innerText    = 'Saving…' }
  if (unsleevdBtn){ unsleevdBtn.disabled = true; unsleevdBtn.innerText = 'Saving…' }

  // Safety net: always re-enable after 15s regardless
  const safetyTimer = setTimeout(() => {
    if (saveBtn)    { saveBtn.disabled = false; saveBtn.innerText = 'Save Card' }
    if (unsleevdBtn){ unsleevdBtn.disabled = false; unsleevdBtn.innerText = 'Mark Unsleevd' }
    _saving = false
  }, 15000)

  let errorMsg = null
  try {
    const id   = document.getElementById('f_cardId').value
    const file = document.getElementById('f_fileInput').files[0] || _pendingImageFile
    _pendingImageFile = null
    let imageUrl = id ? (state.ALL_CARDS.find(x => x.id === id)?.['App Image'] || '') : ''

    if (file) {
      if (auth.currentUser) await auth.currentUser.getIdToken(true)
      const storageRef = ref(storage, `cards/${Date.now()}_${file.name}`)
      const snapshot   = await uploadBytes(storageRef, file)
      imageUrl         = await getDownloadURL(snapshot.ref)
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
      Owned: id ? (state.ALL_CARDS.find(x => x.id === id)?.Owned ?? true) : owned,
    }

    // deleteField() is only valid in setDoc/updateDoc, not addDoc
    if (id) cardData.Patch = deleteField()

    if (id) await setDoc(doc(db, 'Cards', id), cardData, { merge: true })
    else    await addDoc(collection(db, 'Cards'), cardData)

    closeAllForms()
  } catch (e) {
    console.error('saveCard error:', e)
    errorMsg = e?.code || e?.message || 'Save failed'
  } finally {
    clearTimeout(safetyTimer)
    _saving = false
    if (saveBtn)    { saveBtn.disabled = false;    saveBtn.innerText    = errorMsg ? `⚠ ${errorMsg}` : 'Saved!' }
    if (unsleevdBtn){ unsleevdBtn.disabled = false; unsleevdBtn.innerText = 'Mark Unsleevd' }
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
