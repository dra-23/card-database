import { db, doc, onSnapshot, setDoc } from '../firebase.js'

// Cardsight call budget, shown on the Settings page. Calls are counted and
// the limit enforced server-side by the proxy (functions/index.js), which
// reads its limits from Settings/cardsight and counts into
// CardsightUsage/{period}.

const DEFAULTS = { monthlyLimit: 750, reserve: 50, resetDay: 1 }
let _cfg = { ...DEFAULTS }
let _usage = null
let _period = null
let _usageUnsub = null
let _editing = false
const _listeners = []

const fmt = n => Math.round(n).toLocaleString()
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Same period math as the proxy, so the page reads the doc it counts into
function periodKey(resetDay, now = new Date()) {
  let y = now.getUTCFullYear(), m = now.getUTCMonth()
  if (now.getUTCDate() < resetDay) { m -= 1; if (m < 0) { m = 11; y -= 1 } }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function nextReset(resetDay, now = new Date()) {
  const [y, m] = periodKey(resetDay, now).split('-').map(Number)
  return new Date(Date.UTC(y, m, resetDay)) // month index m = the month after
}

export const usedCalls = () => _usage?.count || 0
export const callsLeft = () => Math.max(0, _cfg.monthlyLimit - usedCalls())
// What background work (pricing, searching) may still spend
export const spendableCalls = () => Math.max(0, _cfg.monthlyLimit - _cfg.reserve - usedCalls())

// Lets other pages (Profile's Refresh) react to usage changes
export function onUsageChange(fn) { _listeners.push(fn) }

function _changed() {
  _render()
  _listeners.forEach(fn => fn())
}

function _watchPeriod() {
  const p = periodKey(_cfg.resetDay)
  if (p === _period) return
  _period = p
  _usageUnsub?.()
  _usageUnsub = onSnapshot(doc(db, 'CardsightUsage', p), snap => {
    _usage = snap.exists() ? snap.data() : { count: 0 }
    _changed()
  })
}

const KIND_LABELS = { pricing: 'Pricing', salesSearch: 'Sales search', catalog: 'Catalog', images: 'Images', identify: 'Photo ID' }

function _html() {
  const used = usedCalls()
  const pct = Math.min(1, used / Math.max(1, _cfg.monthlyLimit))
  const tone = pct >= 0.9 ? '#C62828' : pct >= 0.7 ? '#B8860B' : '#2E7D32'
  const reset = nextReset(_cfg.resetDay).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const kinds = Object.entries(_usage?.kinds || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  return `
    <div class="stat-card">
      <div class="st-card-head">
        <div class="stat-card-title">API calls</div>
        ${_editing ? '' : `<button class="st-link" data-us-edit>Edit<span class="material-symbols-outlined">tune</span></button>`}
      </div>
      <div class="st-usage-figure">
        <span class="st-usage-num">${fmt(used)}</span>
        <span class="st-usage-of">of ${fmt(_cfg.monthlyLimit)} used this month</span>
      </div>
      <span class="st-track st-usage-track"><span class="st-fill" style="--v:${pct.toFixed(4)};background:${tone}"></span></span>
      <div class="st-usage-cap">
        <span>${fmt(callsLeft())} left · resets ${reset}</span>
        <span>${fmt(_cfg.reserve)} kept for photo ID</span>
      </div>
      ${spendableCalls() === 0 ? `<div class="st-usage-warn">Pricing and searches are paused until ${reset} — only photo ID is allowed.</div>` : ''}
      ${kinds.length ? `<div class="st-co-chips">${kinds.map(([k, n]) => `<span class="st-co-chip">${esc(KIND_LABELS[k] || k)}<b>${fmt(n)}</b></span>`).join('')}</div>` : ''}
      ${_editing ? `
      <div class="st-usage-form">
        <label>Monthly limit<input type="number" min="1" inputmode="numeric" id="usLimit" value="${_cfg.monthlyLimit}"></label>
        <label>Reserve for photo ID<input type="number" min="0" inputmode="numeric" id="usReserve" value="${_cfg.reserve}"></label>
        <label>Resets on day<input type="number" min="1" max="28" inputmode="numeric" id="usReset" value="${_cfg.resetDay}"></label>
        <label>Used so far<input type="number" min="0" inputmode="numeric" id="usUsed" value="${used}"></label>
        <div class="st-usage-hint">Match "Used so far" to your Cardsight dashboard — calls made before tracking started aren't counted.</div>
        <div class="st-usage-btns">
          <button class="st-more" data-us-cancel>Cancel</button>
          <button class="st-mv-refresh" data-us-save>Save</button>
        </div>
      </div>` : ''}
    </div>`
}

function _render() {
  if (_editing) return
  const el = document.getElementById('settingsUsage')
  if (el) el.innerHTML = _html()
}

async function _save() {
  const num = (id, min, max) => {
    const v = parseInt(document.getElementById(id)?.value, 10)
    return isNaN(v) ? null : Math.min(max, Math.max(min, v))
  }
  const monthlyLimit = num('usLimit', 1, 1e7) ?? _cfg.monthlyLimit
  const reserve = Math.min(monthlyLimit, num('usReserve', 0, 1e7) ?? _cfg.reserve)
  const resetDay = num('usReset', 1, 28) ?? _cfg.resetDay
  const used = num('usUsed', 0, 1e7)
  await setDoc(doc(db, 'Settings', 'cardsight'), { monthlyLimit, reserve, resetDay }, { merge: true })
  if (used != null && used !== usedCalls()) {
    await setDoc(doc(db, 'CardsightUsage', periodKey(resetDay)), { count: used }, { merge: true })
  }
  _editing = false
  _render()
}

// Call once signed in
export function initCardsightUsage() {
  onSnapshot(doc(db, 'Settings', 'cardsight'), snap => {
    _cfg = { ...DEFAULTS, ...(snap.exists() ? snap.data() : {}) }
    _watchPeriod()
    _changed()
  })
  _watchPeriod()

  document.getElementById('settingsUsage')?.addEventListener('click', e => {
    if (e.target.closest('[data-us-edit]'))   { _editing = true; document.getElementById('settingsUsage').innerHTML = _html(); return }
    if (e.target.closest('[data-us-cancel]')) { _editing = false; _render(); return }
    if (e.target.closest('[data-us-save]'))   { _save() }
  })
  _render()
}
