import { db, doc, setDoc, addDoc, collection, deleteField, storage, ref, uploadBytes, getDownloadURL } from '../firebase.js'
import { auth } from '../firebase.js'
import * as state from '../state.js'
import { isOwned, getCleanImg, syncChoice } from '../utils.js'
import { closeAllForms } from '../gestures.js'
import { cardsight } from '../cardsight.js'

const _SPORT_KW = [
  ['baseball','Baseball'],['basketball','Basketball'],['football','Football'],
  ['hockey','Hockey'],['golf','Golf'],['soccer','Soccer'],
]
function _sportFromName(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  for (const [kw, sport] of _SPORT_KW) { if (n.includes(kw)) return sport }
  return ''
}

// Photo button + AI status line beside the thumbnail
function _setPhotoStatus(status, note = '') {
  const btn   = document.getElementById('selectPhotoBtn')
  const icon  = document.getElementById('selectPhotoIcon')
  const label = document.getElementById('selectPhotoLabel')
  const tag   = document.getElementById('f_ai_tag')
  const hint  = document.getElementById('f_photo_hint')
  const hasPhoto = document.getElementById('f_imagePreview')?.style.display === 'block'
  const isEdit = !!document.getElementById('f_cardId')?.value
  if (btn) btn.disabled = status === 'identifying'
  if (icon) icon.textContent = status === 'identifying' ? 'progress_activity' : 'photo_camera'
  icon?.classList.toggle('cf2-spin', status === 'identifying')
  if (label) label.textContent = status === 'identifying' ? 'Identifying…' : hasPhoto ? 'Change photo' : 'Add photo'
  if (tag) {
    tag.style.display = status === 'matched' || status === 'nomatch' ? '' : 'none'
    tag.className = `cf2-ai-tag${status === 'nomatch' ? ' cf2-ai-miss' : ''}`
    tag.innerHTML = status === 'matched'
      ? '<span class="material-symbols-outlined">auto_awesome</span>Matched by AI'
      : status === 'nomatch' ? `<span class="material-symbols-outlined">help</span>${note || 'No match, fill in below'}` : ''
  }
  if (hint) hint.style.display = !isEdit && status === 'idle' ? '' : 'none'
}

async function _identifyAndPrefill(file) {
  _setPhotoStatus('identifying')

  try {
    const { data, error } = await cardsight.identify.card(file)
    if (error || !data?.detections?.length) {
      _setPhotoStatus('nomatch', error?.error === 'budget' ? 'Monthly AI limit reached' : '')
      return
    }

    const top     = data.detections[0]
    const card    = top.card
    const grading = top.grading

    const fill = (id, val) => {
      if (!val) return
      const el = document.getElementById(id)
      if (el && !el.value) el.value = val
    }

    fill('f_year',         card.year ? String(card.year) : '')
    fill('f_set',          card.setName || '')
    fill('f_number',       card.number  ? String(card.number) : '')
    fill('f_manufacturer', card.manufacturer || '')

    const sport   = _sportFromName(card.releaseName || card.setName)
    const sportEl = document.getElementById('f_sport')
    if (sport && sportEl && !sportEl.value) sportEl.value = sport

    if (card.name) {
      const playerSel = document.getElementById('f_player')
      if (playerSel && !playerSel.value) {
        const match = state.ALL_PLAYERS.find(p =>
          (p.Player || '').toLowerCase() === (card.name || '').toLowerCase()
        )
        if (match) { playerSel.value = match.id; playerSel.dispatchEvent(new Event('change')) }
      }
    }

    const gradingEl = document.getElementById('f_grading')
    if (grading?.company?.name && gradingEl && gradingEl.value === 'Raw') {
      setGrading(grading.company.name)
      if (grading.grade?.value) document.getElementById('f_grade').value = grading.grade.value
    }

    if (card.numberedTo || card.parallel?.numberedTo) setFormFlag('numbered', true)
    if (card.id) _pendingCardsightId = card.id

    _setPhotoStatus('matched')
  } catch (_) {
    _setPhotoStatus('nomatch')
  }
}

// Grading company chips (hidden #f_grading). Grade only applies to slabs.
export function setGrading(company) {
  const input = document.getElementById('f_grading')
  if (!input) return
  input.value = ['PSA', 'BGS', 'SGC', 'CGC'].includes(company) ? company : 'Raw'
  syncChoice('f_grading')
  _syncGradeField()
}
function _syncGradeField() {
  const raw = document.getElementById('f_grading').value === 'Raw'
  document.getElementById('f_grade_field').style.display = raw ? 'none' : ''
  if (raw) document.getElementById('f_grade').value = 'N/A'
}

function _showError(fieldId, show) {
  document.getElementById(fieldId)?.classList.toggle('has-error', show)
}

// One-time wiring (main.js → wireFormButtons)
export function initCardForm() {
  document.getElementById('f_grading')?.addEventListener('change', _syncGradeField)
  document.getElementById('imagePreviewContainer')?.addEventListener('click', () => document.getElementById('f_fileInput').click())
  document.getElementById('f_player')?.addEventListener('change', () => _showError('f_player_field', false))
}

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
const FLAG_IDS = {
  rc:       { hidden: 'f_rc',       btn: 'f_rc_btn' },
  auto:     { hidden: 'f_auto',     btn: 'f_auto_btn' },
  mem:      { hidden: 'f_mem',      btn: 'f_mem_btn' },
  numbered: { hidden: 'f_numbered', btn: 'f_numbered_btn' },
}
export function setFormFlag(flag, active) {
  const cfg = FLAG_IDS[flag]; if (!cfg) return
  const hidden = document.getElementById(cfg.hidden)
  const btn    = document.getElementById(cfg.btn)
  if (!hidden || !btn) return
  hidden.value = active ? 'true' : 'false'
  btn.classList.toggle('selected', active)
  btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  // Serial # only applies to numbered cards
  if (flag === 'numbered') {
    const serial = document.getElementById('f_serial_field')
    if (serial) serial.style.display = active ? '' : 'none'
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

  let activeIndex = -1

  function items() { return [...listEl.querySelectorAll('.field-suggest-item')] }

  function setActive(i) {
    const all = items()
    if (!all.length) { activeIndex = -1; return }
    activeIndex = (i + all.length) % all.length
    all.forEach((el, idx) => el.classList.toggle('field-suggest-active', idx === activeIndex))
    all[activeIndex].scrollIntoView({ block: 'nearest' })
  }

  function pick(item) {
    input.value = item.textContent
    listEl.style.display = 'none'
    activeIndex = -1
  }

  function show(q) {
    const opts = input._suggestOpts || []
    const filtered = q
      ? opts.filter(v => v.toLowerCase().includes(q.toLowerCase()))
      : opts
    activeIndex = -1
    if (!filtered.length) { listEl.style.display = 'none'; return }
    listEl.innerHTML = filtered.slice(0, 30).map(v =>
      `<div class="field-suggest-item">${v}</div>`
    ).join('')
    listEl.style.display = 'block'
    listEl.querySelectorAll('.field-suggest-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        pick(item)
      })
    })
  }

  input.addEventListener('focus', () => show(input.value))
  input.addEventListener('input', () => show(input.value))
  input.addEventListener('blur',  () => setTimeout(() => { listEl.style.display = 'none' }, 150))

  // Arrow keys move the highlight through whichever items are currently
  // showing; Enter picks the highlighted one (or just closes the list if
  // nothing's highlighted, so a plain Enter still submits/tabs normally).
  input.addEventListener('keydown', e => {
    if (listEl.style.display === 'none') return
    const all = items()
    if (!all.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(activeIndex - 1)
    } else if (e.key === 'Enter') {
      if (activeIndex < 0) return
      e.preventDefault()
      pick(all[activeIndex])
    } else if (e.key === 'Escape') {
      listEl.style.display = 'none'
      activeIndex = -1
    }
  })
}

// ── Save card ──────────────────────────────────────────────────────────────
let _pendingImageFile    = null  // set by card-search when scan image should be uploaded
let _pendingCardsightId  = null  // set by card-search when a CardSight result is selected

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
  const editCard = isEdit ? state.ALL_CARDS.find(x => x.id === cardId) : null
  document.getElementById('cardFormTitle').innerText = isEdit ? 'Edit card' : 'Add card'
  document.getElementById('cardFormSub').innerText = editCard
    ? [contextPlayer?.Player, [editCard.Year, editCard.Set].filter(Boolean).join(' ') + (editCard.Number ? ` #${editCard.Number}` : '')].filter(Boolean).join(' · ')
    : contextPlayer && ctx === 'player' ? `For ${contextPlayer.Player || contextPlayer.id}` : 'Snap a photo and AI fills in the details'
  document.getElementById('f_cardId').value = cardId || ''

  const saveBtn = document.getElementById('btnSaveCard')
  saveBtn.disabled = false
  saveBtn.innerText = isEdit ? 'Save changes' : 'Add card'
  document.getElementById('f_owned').checked = editCard ? isOwned(editCard) : true
  _showError('f_player_field', false)
  document.querySelector('#cardFormSheet .cf2-scroll').scrollTop = 0

  // Photo always starts from this card's own image (or none) — never a
  // leftover preview from the last card opened
  const preview = document.getElementById('f_imagePreview')
  const existingImg = editCard ? getCleanImg(editCard['App Image']) : ''
  preview.src = existingImg || ''
  preview.style.display = existingImg ? 'block' : 'none'
  document.getElementById('previewPlaceholder').style.display = existingImg ? 'none' : ''
  document.getElementById('f_fileInput').value = ''

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
    const c = editCard
    if (!c) return
    document.getElementById('f_year').value         = c.Year || ''
    document.getElementById('f_set').value          = c.Set || ''
    document.getElementById('f_number').value       = c.Number || ''
    document.getElementById('f_manufacturer').value = c.Manufacturer || ''
    document.getElementById('f_sport').value        = c.Sport || ''
    document.getElementById('f_team').value         = c.Team || ''
    setGrading(c['Grading Company'] || 'Raw')
    document.getElementById('f_grade').value        = c.Grade || 'N/A'
    document.getElementById('f_price').value        = c.Price || ''
    document.getElementById('f_url').value          = c['Card Information'] || ''
    document.getElementById('f_serialnumber').value = c.SerialNumber || ''
    setFormFlag('rc',       c.RC       === true || c.RC       === 'true')
    setFormFlag('auto',     c.Auto     === true || c.Auto     === 'true')
    setFormFlag('mem',      c.Mem === true || c.Mem === 'true' || c.Patch === true || c.Patch === 'true')
    setFormFlag('numbered', c.Numbered === true || c.Numbered === 'true')
  } else {
    ;['f_year','f_set','f_number','f_manufacturer','f_price','f_url'].forEach(id => { document.getElementById(id).value = '' })
    document.getElementById('f_sport').value   = (ctx === 'player' && contextPlayer) ? (contextPlayer.Sport || '') : ''
    setGrading('Raw')
    setFormFlag('rc', false); setFormFlag('auto', false)
    setFormFlag('mem', false); setFormFlag('numbered', false)
    document.getElementById('f_serialnumber').value = ''
    _pendingImageFile   = null
    _pendingCardsightId = null

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
        setGrading(prefill.gradingCompany)
        if (prefill.grade) document.getElementById('f_grade').value = prefill.grade
      }
      if (prefill.imageFile) {
        _pendingImageFile = prefill.imageFile
        document.getElementById('f_imagePreview').src           = prefill.imagePreview || ''
        document.getElementById('f_imagePreview').style.display = 'block'
        document.getElementById('previewPlaceholder').style.display = 'none'
      }
      if (prefill.cardsightId) _pendingCardsightId = prefill.cardsightId
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

  _setPhotoStatus(prefill?.cardsightId ? 'matched' : 'idle')

  const sheet = document.getElementById('cardFormSheet')
  sheet.classList.add('open')
  const scrim = document.getElementById('globalScrim')
  scrim.style.zIndex = '1150'
  scrim.style.display = 'block'
}

// ── Save card ──────────────────────────────────────────────────────────────
let _saving = false

export async function saveCard() {
  if (_saving) return

  // Every card belongs to a player
  if (!document.getElementById('f_player').value) {
    _showError('f_player_field', true)
    document.getElementById('f_player_field').scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  _saving = true

  const saveBtn   = document.getElementById('btnSaveCard')
  const idleLabel = document.getElementById('f_cardId').value ? 'Save changes' : 'Add card'
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'Saving…' }

  // Safety net: always re-enable after 15s regardless
  const safetyTimer = setTimeout(() => {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = idleLabel }
    _saving = false
  }, 15000)

  let errorMsg = null
  try {
    const id   = document.getElementById('f_cardId').value
    const file = document.getElementById('f_fileInput').files[0] || _pendingImageFile
    _pendingImageFile   = null
    const cardsightId   = _pendingCardsightId
    _pendingCardsightId = null
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
      Numbered:     document.getElementById('f_numbered').value === 'true',
      SerialNumber: document.getElementById('f_serialnumber').value,
      Owned: document.getElementById('f_owned').checked,
      ...(cardsightId && !id ? { CardsightId: cardsightId } : {}),
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
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = errorMsg ? `Couldn't save. Try again` : idleLabel }
  }
}

// ── File preview ───────────────────────────────────────────────────────────
let _identifying = false
export function handleFileSelect(input) {
  const file = input.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('f_imagePreview').src           = e.target.result
    document.getElementById('f_imagePreview').style.display = 'block'
    document.getElementById('previewPlaceholder').style.display = 'none'
    if (!_identifying) _setPhotoStatus('idle')
  }
  reader.readAsDataURL(file)

  // Auto-identify only when adding a new card
  if (!document.getElementById('f_cardId').value) {
    _identifying = true
    _identifyAndPrefill(file).finally(() => { _identifying = false })
  }
}
