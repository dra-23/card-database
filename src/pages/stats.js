import * as state from '../state.js'
import { isOwned, getCleanImg, escapeAttr } from '../utils.js'
import { auth, db, doc, writeBatch } from '../firebase.js'
import { spendableCalls, onUsageChange } from '../components/cardsight-usage.js'
import { switchPage, isWideLayout } from '../layout.js'
import { openDetail } from './players.js'
import { handleCardTap } from '../components/card-detail.js'
import { priceCard, savedMarketValue, isBudgetError } from '../services/market-value.js'

const truthy = v => v === true || v === 'true'
const isGraded = c => c['Grading Company'] && c['Grading Company'] !== 'Raw'
const fmt = n => Math.round(n).toLocaleString()
const fmtMoney = n => '$' + Math.round(n).toLocaleString()
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BADGES = [
  { label: 'RC',   cls: 'badge-rc',       color: '#E8192C', filter: 'collRC',       test: c => truthy(c.RC) },
  { label: 'AUTO', cls: 'badge-auto',     color: '#B8860B', filter: 'collAuto',     test: c => truthy(c.Auto) },
  { label: 'MEM',  cls: 'badge-mem',      color: '#1565C0', filter: 'collMem',      test: c => truthy(c.Mem) || truthy(c.Patch) },
  { label: "#'d",  cls: 'badge-numbered', color: '#78909C', filter: 'collNumbered', test: c => truthy(c.Numbered) },
]

const SPORT_COLORS = {
  Baseball:   '#1565C0',
  Basketball: '#E8192C',
  Football:   '#2E7D32',
  Hockey:     '#00838F',
  Golf:       '#7CB342',
  Soccer:     '#F57F17',
}
const OTHER_COLOR = '#8A8CA0'

const GRADE_CO_COLORS = { PSA: 'var(--co-psa)', BGS: 'var(--co-bgs)', SGC: 'var(--co-sgc)', CGC: 'var(--co-cgc)' }

function gradeColor(g) {
  if (g >= 9) return '#2E7D32'
  if (g >= 7) return '#3D5AFE'
  if (g >= 5) return '#B8860B'
  return '#E8192C'
}

// Interactive state — survives the re-render every Firestore update triggers
let _sport = null          // highlighted donut segment
let _playerMetric = 'cards'
let _playersExpanded = false
let _yearMode = 'year'
let _yearSel = null        // scrubbed bar index (null = peak)
let _data = null
let _wired = false
let _mvJob = null          // { done, total } while a Refresh values run is in flight
let _mvNote = ''           // result line from the last run

const PLAYERS_COLLAPSED = 5

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Data ────────────────────────────────────────────────────────────────────
function compute() {
  const all      = state.ALL_CARDS
  const owned    = all.filter(isOwned)
  const graded   = owned.filter(isGraded)
  const priced   = owned.filter(c => parseFloat(c.Price) > 0)
  const paid     = priced.reduce((s, c) => s + parseFloat(c.Price), 0)

  const sportMap = {}
  owned.forEach(c => {
    const s = SPORT_COLORS[c.Sport] ? c.Sport : 'Other'
    sportMap[s] = (sportMap[s] || 0) + 1
  })
  const sports = Object.entries(sportMap)
    .map(([name, count]) => ({ name, count, color: SPORT_COLORS[name] || OTHER_COLOR }))
    .sort((a, b) => b.count - a.count)

  const playerMap = {}
  owned.forEach(c => {
    if (!c.Player) return
    const p = playerMap[c.Player] || (playerMap[c.Player] = { cards: 0, paid: 0 })
    p.cards++
    p.paid += parseFloat(c.Price) || 0
  })
  const players = Object.entries(playerMap).map(([id, v]) => {
    const p = state.ALL_PLAYERS.find(pl => pl.id === id)
    return { id, name: p?.Player || id, img: getCleanImg(p?.['Main Image']), ...v }
  })

  // Season strings like "1998-99" count toward their starting year
  const yearMap = {}
  owned.forEach(c => {
    const y = parseInt(String(c.Year || '').slice(0, 4))
    if (!isNaN(y)) yearMap[y] = (yearMap[y] || 0) + 1
  })
  const yrs = Object.keys(yearMap).map(Number)
  const years = []
  if (yrs.length) {
    for (let y = Math.min(...yrs); y <= Math.max(...yrs); y++) years.push({ key: y, label: String(y), count: yearMap[y] || 0 })
  }
  const decadeMap = {}
  years.forEach(y => { const d = Math.floor(y.key / 10) * 10; decadeMap[d] = (decadeMap[d] || 0) + y.count })
  const decades = Object.entries(decadeMap).map(([d, count]) => ({ key: +d, label: `${String(d).slice(2)}s`, full: `${d}s`, count }))

  const gradeMap = {}
  const coMap = {}
  graded.forEach(c => {
    const co = c['Grading Company']
    coMap[co] = (coMap[co] || 0) + 1
    const g = parseFloat(c.Grade)
    if (isNaN(g)) return
    gradeMap[g] = (gradeMap[g] || 0) + 1
  })
  const grades = Object.entries(gradeMap).map(([g, count]) => ({ grade: +g, count })).sort((a, b) => b.grade - a.grade)
  const companies = Object.entries(coMap).sort((a, b) => b[1] - a[1])
  const gradeVals = graded.map(c => parseFloat(c.Grade)).filter(g => !isNaN(g))
  const avgGrade = gradeVals.length ? gradeVals.reduce((s, g) => s + g, 0) / gradeVals.length : 0
  const gems = gradeVals.filter(g => g >= 10).length

  const valued = owned.filter(c => savedMarketValue(c) != null)
  const valuedPriced = valued.filter(c => parseFloat(c.Price) > 0)
  const market = {
    total: valued.reduce((s, c) => s + savedMarketValue(c), 0),
    count: valued.length,
    linked: owned.filter(c => c.CardsightId).length,
    // Gain/loss only over cards that have both a value and a purchase price
    paidBasis: valuedPriced.reduce((s, c) => s + parseFloat(c.Price), 0),
    valueBasis: valuedPriced.reduce((s, c) => s + savedMarketValue(c), 0),
    basisCount: valuedPriced.length,
    updatedAt: Math.max(0, ...valued.map(c => c.MarketValueAt || 0)),
    top: [...valued].sort((a, b) => savedMarketValue(b) - savedMarketValue(a)).slice(0, 3).map(c => {
      const p = state.ALL_PLAYERS.find(pl => pl.id === c.Player)
      return {
        id: c.id,
        title: [c.Year, c.Set].filter(Boolean).join(' ') + (c.Number ? ` #${c.Number}` : ''),
        player: p?.Player || c.Player || '',
        img: c.PSAImage || getCleanImg(c['App Image']),
        value: savedMarketValue(c),
        grade: isGraded(c) ? `${c['Grading Company']} ${c.Grade || ''}`.trim() : '',
      }
    }),
  }

  return {
    market,
    total: all.length,
    owned: owned.length,
    wishlist: all.length - owned.length,
    graded: graded.length,
    favorites: all.filter(c => truthy(c.Favorite)).length,
    playerCount: state.ALL_PLAYERS.length,
    sets: new Set(owned.map(c => `${c.Year}|${c.Set}`)).size,
    paid, pricedCount: priced.length,
    badges: BADGES.map(b => ({ ...b, count: owned.filter(b.test).length })),
    sports, players, years, decades, grades, companies, avgGrade, gems,
  }
}

// ── Sections ────────────────────────────────────────────────────────────────
function heroHTML(d, user) {
  const pct = d.total ? (d.owned / d.total) * 100 : 0
  const name = user?.displayName?.split(' ')[0] || 'Collector'
  return `
    <section class="st-hero">
      <div class="st-hero-top">
        ${user?.photoURL
          ? `<img class="st-avatar" src="${escapeAttr(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
          : `<div class="st-avatar st-avatar-ph"><span class="material-symbols-outlined">person</span></div>`}
        <div class="st-hero-who">
          <div class="st-hero-hello">${esc(name)}'s collection</div>
          ${user?.email ? `<div class="st-hero-email">${esc(user.email)}</div>` : ''}
        </div>
      </div>
      <div class="st-hero-figure">
        <div>
          <div class="st-hero-num" data-count="${d.owned}">${fmt(d.owned)}</div>
          <div class="st-hero-lbl">cards sleevd</div>
        </div>
        ${d.paid > 0 ? `
        <div class="st-hero-paid">
          <div class="st-hero-paid-num" data-count="${d.paid}" data-money>${fmtMoney(d.paid)}</div>
          <div class="st-hero-lbl">paid · ${fmt(d.pricedCount)} priced</div>
        </div>` : ''}
      </div>
      <div class="st-hero-meter" role="img" aria-label="${pct.toFixed(0)} percent of tracked cards sleevd">
        <div class="st-hero-meter-fill st-fill" style="--v:${(pct / 100).toFixed(4)}"></div>
      </div>
      <div class="st-hero-meter-cap">
        <span>${pct.toFixed(0)}% of ${fmt(d.total)} tracked cards</span>
        <span>${fmt(d.sets)} sets</span>
      </div>
    </section>`
}

function tilesHTML(d) {
  const tile = (icon, count, label, nav, extra = '', tint) => `
    <button class="st-tile" data-st-nav="${nav}" ${extra} style="--tint:${tint}">
      <span class="st-tile-icon material-symbols-outlined">${icon}</span>
      <span class="st-tile-num" data-count="${count}">${fmt(count)}</span>
      <span class="st-tile-lbl">${label}</span>
      <span class="st-tile-go material-symbols-outlined">arrow_forward</span>
    </button>`
  return `
    <section class="st-tiles">
      ${tile('inventory_2', d.wishlist, 'Unsleevd', 'collection', 'data-filter="collWishlist"', '#78909C')}
      ${tile('workspace_premium', d.graded, 'Graded', 'graded', '', '#2E7D32')}
      ${tile('star', d.favorites, 'Favorites', 'collection', 'data-filter="collFavorite"', '#C9A227')}
      ${tile('groups', d.playerCount, 'Players', 'players', '', '#6b7cde')}
    </section>`
}

function timeAgo(ms) {
  const s = (Date.now() - ms) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const days = Math.floor(s / 86400)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function marketHTML(d) {
  const m = d.market
  if (!m.linked && !m.count) return ''
  const gain = m.valueBasis - m.paidBasis
  const gainPct = m.paidBasis ? (gain / m.paidBasis) * 100 : 0
  const up = gain >= 0
  return `
    <section class="stat-card st-mv-card" id="stMarket">
      <div class="st-card-head">
        <div class="stat-card-title">Market Value</div>
        <button class="st-mv-refresh" data-st-mv-refresh ${_mvJob || !m.linked || !spendableCalls() ? 'disabled' : ''} aria-label="Refresh market values">
          <span class="material-symbols-outlined${_mvJob ? ' st-spin' : ''}">refresh</span>${_mvJob ? 'Pricing…' : 'Refresh'}
        </button>
      </div>
      ${m.count ? `
      <div class="st-mv-figure">
        <div class="st-mv-num" data-count="${m.total}" data-money>${fmtMoney(m.total)}</div>
        ${m.basisCount ? `
        <div class="st-mv-delta ${up ? 'st-up' : 'st-down'}">
          <span class="material-symbols-outlined">${up ? 'trending_up' : 'trending_down'}</span>
          ${up ? '+' : '−'}${fmtMoney(Math.abs(gain))} (${up ? '+' : '−'}${Math.abs(gainPct).toFixed(0)}%)
        </div>
        <div class="st-mv-sub">vs. ${fmtMoney(m.paidBasis)} paid on ${fmt(m.basisCount)} of these ${m.basisCount === 1 ? 'card' : 'cards'}</div>` : ''}
      </div>
      <div class="st-mv-cover">
        <span class="st-track st-track-thin"><span class="st-fill" style="--v:${(m.count / Math.max(1, d.owned)).toFixed(4)}"></span></span>
        <span>${fmt(m.count)} of ${fmt(d.owned)} cards valued</span>
      </div>
      <div class="st-mv-top">
        ${m.top.map((c, i) => `
          <button class="st-mv-row" data-st-card="${escapeAttr(c.id)}" style="--i:${i}">
            ${c.img ? `<img class="st-mv-thumb" src="${escapeAttr(c.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="st-mv-thumb"></span>`}
            <span class="st-mv-row-main">
              <span class="st-mv-row-title">${esc(c.title)}</span>
              <span class="st-mv-row-sub">${esc(c.player)}${c.grade ? ` · ${esc(c.grade)}` : ''}</span>
            </span>
            <span class="st-mv-row-val">${fmtMoney(c.value)}</span>
          </button>`).join('')}
      </div>` : `
      <div class="st-mv-empty">
        No saved values yet. Tap Refresh to price the ${fmt(m.linked)} ${m.linked === 1 ? 'card' : 'cards'} linked to Cardsight.
      </div>`}
      <div class="st-mv-foot" id="stMvFoot">${mvFootHTML(d)}</div>
    </section>`
}

function mvFootHTML(d) {
  const m = d.market
  if (_mvJob) {
    return `<span class="st-track st-track-thin st-mv-progress"><span class="st-fill" style="--v:${(_mvJob.done / Math.max(1, _mvJob.total)).toFixed(4)}"></span></span>
      <span>Pricing ${fmt(_mvJob.done)} of ${fmt(_mvJob.total)}…</span>`
  }
  const parts = []
  if (_mvNote) parts.push(_mvNote)
  else if (m.updatedAt) parts.push(`Updated ${timeAgo(m.updatedAt)}`)
  if (m.linked < d.owned) parts.push(`${fmt(m.linked)} linked to Cardsight`)
  if (!_mvNote && m.linked) parts.push(`Refresh ≈ ${fmt(estimateRefreshCalls(state.ALL_CARDS.filter(c => isOwned(c) && c.CardsightId)))} calls`)
  return `<span>${parts.join(' · ')}</span>`
}

// Re-render the Market Value card in place (e.g. when call usage changes)
function _syncMarket() {
  const mk = document.getElementById('stMarket')
  if (!mk || !_data || _mvJob) return
  const t = document.createElement('div')
  t.innerHTML = marketHTML(_data).trim()
  mk.replaceWith(t.firstElementChild)
}
onUsageChange(_syncMarket)

// Rough count of calls a full Refresh will make: pricing for every card, a
// catalog lookup for cards whose parallel isn't resolved yet, and a sales
// search + base-price check for parallel cards
function estimateRefreshCalls(cards) {
  return cards.reduce((n, c) => {
    const p = c.CardsightParallel
    if (!p?.sig?.startsWith('2|')) return n + 2
    return n + (p.id ? 3 : 1)
  }, 0)
}

// Re-price every linked card, then save in one batch so the page re-renders
// once at the end instead of once per card
async function refreshAllValues() {
  if (_mvJob) return
  const cards = state.ALL_CARDS.filter(c => isOwned(c) && c.CardsightId)
  if (!cards.length) return
  const est = estimateRefreshCalls(cards)
  if (est > spendableCalls()) {
    _mvNote = `Refresh needs about ${fmt(est)} calls — only ${fmt(spendableCalls())} available this month`
    _syncMarket()
    return
  }
  if (!confirm(`Refresh uses about ${fmt(est)} of your ${fmt(spendableCalls())} remaining Cardsight calls this month. Continue?`)) return
  _mvJob = { done: 0, total: cards.length }
  _mvNote = ''
  _replaceSection('stMarket', marketHTML(_data))

  const updates = []
  let next = 0, priced = 0, missing = 0, failed = 0, outOfBudget = false
  const worker = async () => {
    while (next < cards.length && !outOfBudget) {
      const c = cards[next++]
      try {
        const { mv, fields, error } = await priceCard(c, { force: true })
        if (fields) updates.push([c.id, fields])
        if (isBudgetError(error)) outOfBudget = true
        else if (error) failed++
        else if (!mv) missing++
        else priced++
      } catch { failed++ }
      _mvJob.done++
      const foot = document.getElementById('stMvFoot')
      if (foot) foot.innerHTML = mvFootHTML(_data)
    }
  }
  await Promise.all([worker(), worker(), worker()])

  try {
    for (let i = 0; i < updates.length; i += 400) {
      const batch = writeBatch(db)
      updates.slice(i, i + 400).forEach(([id, fields]) => batch.set(doc(db, 'Cards', id), fields, { merge: true }))
      await batch.commit()
    }
    const notes = [`Priced ${fmt(priced)} ${priced === 1 ? 'card' : 'cards'}`]
    if (missing) notes.push(`${fmt(missing)} with no sales data`)
    if (failed) notes.push(`${fmt(failed)} failed`)
    if (outOfBudget) notes.push('stopped — monthly limit reached')
    _mvNote = notes.join(' · ')
  } catch (e) {
    console.error('[refreshAllValues]', e)
    _mvNote = 'Couldn’t save values — try again'
  }
  _mvJob = null
  if (state.currentPage === 'stats') renderStats()
}

function badgesHTML(d) {
  const max = Math.max(1, ...d.badges.map(b => b.count))
  if (!d.badges.some(b => b.count)) return ''
  return `
    <section class="stat-card">
      <div class="st-card-head"><div class="stat-card-title">Badges</div></div>
      <div class="st-badge-list">
        ${d.badges.map((b, i) => `
          <button class="st-badge-row" data-st-nav="collection" data-filter="${b.filter}" style="--i:${i}">
            <span class="${b.cls} st-badge-pill">${b.label}</span>
            <span class="st-track"><span class="st-fill" style="--v:${(b.count / max).toFixed(4)};background:${b.color}"></span></span>
            <span class="st-badge-count" data-count="${b.count}">${fmt(b.count)}</span>
            <span class="st-badge-pct">${d.owned ? ((b.count / d.owned) * 100).toFixed(1) : 0}%</span>
          </button>`).join('')}
      </div>
    </section>`
}

function sportHTML(d) {
  if (!d.sports.length) return ''
  const R = 40, W = 11
  const capPct = (W / (2 * Math.PI * R)) * 100 // round caps overhang each end
  const multi = d.sports.length > 1
  let offset = 0
  const segs = d.sports.map((s, i) => {
    const share = (s.count / d.owned) * 100
    const len = multi ? Math.max(0.001, share - capPct - 1.6) : 100
    const seg = `<circle class="st-seg${_sport === s.name ? ' st-seg-on' : ''}" data-st-sport="${escapeAttr(s.name)}"
      cx="50" cy="50" r="${R}" pathLength="100" stroke="${s.color}" stroke-width="${W}"
      style="--len:${len.toFixed(3)};--i:${i};stroke-dashoffset:${(-(offset + (multi ? capPct / 2 + 0.8 : 0))).toFixed(3)}"></circle>`
    offset += share
    return seg
  }).join('')
  return `
    <section class="stat-card st-sport-card${_sport ? ' st-has-sel' : ''}" id="stSport">
      <div class="st-card-head"><div class="stat-card-title">By Sport</div></div>
      <div class="st-sport-body">
        <div class="st-donut-wrap">
          <svg class="st-donut" viewBox="0 0 100 100" aria-hidden="true">${segs}</svg>
          <div class="st-donut-center" id="stDonutCenter">${donutCenterHTML(d)}</div>
        </div>
        <div class="st-legend">
          ${d.sports.map(s => `
            <button class="st-legend-row${_sport === s.name ? ' st-legend-on' : ''}" data-st-sport="${escapeAttr(s.name)}">
              <span class="st-dot" style="background:${s.color}"></span>
              <span class="st-legend-name">${esc(s.name)}</span>
              <span class="st-legend-val">${fmt(s.count)}</span>
            </button>`).join('')}
        </div>
      </div>
    </section>`
}

function donutCenterHTML(d) {
  const s = d.sports.find(x => x.name === _sport)
  if (!s) return `<div class="st-dc-num">${d.sports.length}</div><div class="st-dc-lbl">${d.sports.length === 1 ? 'sport' : 'sports'}</div>`
  return `<div class="st-dc-num" style="color:${s.color}">${((s.count / d.owned) * 100).toFixed(s.count / d.owned < 0.01 ? 1 : 0)}%</div><div class="st-dc-lbl">${esc(s.name)}</div>`
}

function playersHTML(d) {
  if (!d.players.length) return ''
  const key = _playerMetric
  const list = [...d.players].sort((a, b) => b[key] - a[key] || b.cards - a.cards)
  const shown = _playersExpanded ? list : list.slice(0, PLAYERS_COLLAPSED)
  const max = Math.max(1, list[0][key])
  const hasPaid = d.players.some(p => p.paid > 0)
  return `
    <section class="stat-card" id="stPlayers">
      <div class="st-card-head">
        <div class="stat-card-title">Top Players</div>
        ${hasPaid ? `
        <div class="st-seg-ctl" role="tablist">
          <button class="${key === 'cards' ? 'on' : ''}" data-st-metric="cards">Cards</button>
          <button class="${key === 'paid' ? 'on' : ''}" data-st-metric="paid">Paid</button>
        </div>` : ''}
      </div>
      <div class="st-player-list">
        ${shown.map((p, i) => `
          <button class="st-player-row" data-st-player="${escapeAttr(p.id)}" style="--i:${i}">
            <span class="st-rank">${i + 1}</span>
            ${p.img ? `<img class="st-player-img" src="${escapeAttr(p.img)}" alt="" loading="lazy">` : `<span class="st-player-img st-player-img-ph material-symbols-outlined">person</span>`}
            <span class="st-player-main">
              <span class="st-player-name">${esc(p.name)}</span>
              <span class="st-track st-track-thin"><span class="st-fill" style="--v:${(p[key] / max).toFixed(4)}"></span></span>
            </span>
            <span class="st-player-val">${key === 'paid' ? fmtMoney(p.paid) : fmt(p.cards)}</span>
          </button>`).join('')}
      </div>
      ${list.length > PLAYERS_COLLAPSED ? `
      <button class="st-more" data-st-expand>
        ${_playersExpanded ? 'Show less' : `Show all ${list.length}`}
        <span class="material-symbols-outlined">${_playersExpanded ? 'expand_less' : 'expand_more'}</span>
      </button>` : ''}
    </section>`
}

function timelineSeries(d) { return _yearMode === 'decade' ? d.decades : d.years }

function timelineHTML(d) {
  const series = timelineSeries(d)
  if (!series.length) return ''
  const max = Math.max(1, ...series.map(s => s.count))
  const yearTicks = _yearMode === 'year'
  return `
    <section class="stat-card st-timeline-card" id="stTimeline">
      <div class="st-card-head">
        <div class="stat-card-title">Timeline</div>
        <div class="st-seg-ctl">
          <button class="${_yearMode === 'year' ? 'on' : ''}" data-st-yearmode="year">Year</button>
          <button class="${_yearMode === 'decade' ? 'on' : ''}" data-st-yearmode="decade">Decade</button>
        </div>
      </div>
      <div class="st-tl-readout" id="stTlReadout">${readoutHTML(d)}</div>
      <div class="st-tl-bars${_yearMode === 'decade' ? ' st-tl-decades' : ''}" id="stTlBars">
        ${series.map((s, i) => `<div class="st-vbar-slot"><div class="st-vbar" data-i="${i}" style="--v:${Math.max(s.count ? 0.03 : 0, s.count / max).toFixed(4)};--i:${i}"></div></div>`).join('')}
      </div>
      <div class="st-tl-axis">
        ${series.map(s => `<span>${yearTicks ? (s.key % 10 === 0 ? `'${String(s.key).slice(2)}` : '') : s.label}</span>`).join('')}
      </div>
    </section>`
}

function _peakIndex(series) {
  let best = 0
  series.forEach((s, i) => { if (s.count > series[best].count) best = i })
  return best
}

function readoutHTML(d) {
  const series = timelineSeries(d)
  const i = _yearSel ?? _peakIndex(series)
  const s = series[i]
  if (!s) return ''
  const label = _yearMode === 'decade' ? s.full : s.label
  const tag = _yearSel == null ? '<span class="st-tl-tag">Peak</span>' : ''
  return `<span class="st-tl-year">${label}</span><span class="st-tl-count">${fmt(s.count)} ${s.count === 1 ? 'card' : 'cards'}</span>${tag}`
}

function gradesHTML(d) {
  if (!d.graded) return ''
  const max = Math.max(1, ...d.grades.map(g => g.count))
  return `
    <section class="stat-card">
      <div class="st-card-head">
        <div class="stat-card-title">Grades</div>
        <button class="st-link" data-st-nav="graded">View all<span class="material-symbols-outlined">chevron_right</span></button>
      </div>
      <div class="st-grade-stats">
        <div><div class="st-gs-num">${d.avgGrade ? d.avgGrade.toFixed(1) : '–'}</div><div class="st-gs-lbl">avg grade</div></div>
        <div><div class="st-gs-num">${fmt(d.gems)}</div><div class="st-gs-lbl">gem mint 10s</div></div>
        <div><div class="st-gs-num">${fmt(d.graded)}</div><div class="st-gs-lbl">slabs</div></div>
      </div>
      <div class="st-grade-list">
        ${d.grades.map((g, i) => `
          <div class="st-grade-row" style="--i:${i}">
            <span class="st-grade-lbl">${Number.isInteger(g.grade) ? g.grade : g.grade.toFixed(1)}</span>
            <span class="st-track"><span class="st-fill" style="--v:${(g.count / max).toFixed(4)};background:${gradeColor(g.grade)}"></span></span>
            <span class="st-grade-count">${fmt(g.count)}</span>
          </div>`).join('')}
      </div>
      <div class="st-co-chips">
        ${d.companies.map(([co, n]) => `<span class="st-co-chip"><span class="st-dot" style="background:${GRADE_CO_COLORS[co] || OTHER_COLOR}"></span>${esc(co)}<b>${fmt(n)}</b></span>`).join('')}
      </div>
    </section>`
}

// ── Render ──────────────────────────────────────────────────────────────────
export function renderStats({ animate = false } = {}) {
  if (!state.cardsLoaded || !state.playersLoaded) return
  const root = document.getElementById('statsContent')
  if (!root) return
  _data = compute()
  const d = _data
  if (_yearSel != null && _yearSel >= timelineSeries(d).length) _yearSel = null

  root.innerHTML = `
    <div class="stats-content">
      ${heroHTML(d, auth.currentUser)}
      ${tilesHTML(d)}
      ${marketHTML(d)}
      <div class="stats-row-2col">
        ${sportHTML(d)}
        ${badgesHTML(d)}
      </div>
      ${timelineHTML(d)}
      <div class="stats-row-2col">
        ${playersHTML(d)}
        ${gradesHTML(d)}
      </div>
    </div>`

  _wire(root)
  _wireScrub()
  if (animate) _enter(root)
}

// Bars/rings render from zero, then grow in; numbers count up
function _enter(el, { countUp = true } = {}) {
  if (reducedMotion()) return
  el.classList.add('st-pre', 'st-entering')
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('st-pre')
    setTimeout(() => el.classList.remove('st-entering'), 1400)
  }))
  if (countUp) el.querySelectorAll('[data-count]').forEach(_countUp)
}

function _countUp(node) {
  const target = parseFloat(node.dataset.count) || 0
  const money = node.hasAttribute('data-money')
  const show = v => { node.textContent = money ? fmtMoney(v) : fmt(v) }
  if (target === 0) return show(0)
  const dur = 900, t0 = performance.now()
  show(0)
  const step = now => {
    const t = Math.min(1, (now - t0) / dur)
    show(target * (1 - Math.pow(1 - t, 3)))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function _replaceSection(id, html) {
  const old = document.getElementById(id)
  if (!old || !html) return
  const tmp = document.createElement('div')
  tmp.innerHTML = html.trim()
  const next = tmp.firstElementChild
  old.replaceWith(next)
  _enter(next, { countUp: false })
  if (id === 'stTimeline') _wireScrub()
}

// ── Interaction ─────────────────────────────────────────────────────────────
function _wire(root) {
  if (_wired) return
  _wired = true
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-st-nav],[data-st-player],[data-st-sport],[data-st-metric],[data-st-yearmode],[data-st-expand],[data-st-card],[data-st-mv-refresh]')
    if (!t || !_data) return

    if (t.hasAttribute('data-st-mv-refresh')) { refreshAllValues(); return }
    if (t.dataset.stCard) {
      // Wide layouts show card detail inside the Collection pane
      if (isWideLayout()) switchPage('collection')
      handleCardTap(t.dataset.stCard, 'collection')
      return
    }

    if (t.dataset.stNav) {
      if (t.dataset.filter) window._showCollectionFiltered?.([t.dataset.filter])
      else switchPage(t.dataset.stNav)
      return
    }
    if (t.dataset.stPlayer) {
      switchPage('players')
      openDetail(t.dataset.stPlayer)
      return
    }
    if (t.dataset.stSport) {
      _sport = _sport === t.dataset.stSport ? null : t.dataset.stSport
      _syncSport()
      return
    }
    if (t.dataset.stMetric && t.dataset.stMetric !== _playerMetric) {
      _playerMetric = t.dataset.stMetric
      _replaceSection('stPlayers', playersHTML(_data))
      return
    }
    if (t.hasAttribute('data-st-expand')) {
      _playersExpanded = !_playersExpanded
      _replaceSection('stPlayers', playersHTML(_data))
      return
    }
    if (t.dataset.stYearmode && t.dataset.stYearmode !== _yearMode) {
      _yearMode = t.dataset.stYearmode
      _yearSel = null
      _replaceSection('stTimeline', timelineHTML(_data))
    }
  })
}

function _syncSport() {
  const card = document.getElementById('stSport')
  if (!card) return
  card.classList.toggle('st-has-sel', !!_sport)
  card.querySelectorAll('.st-seg').forEach(s => s.classList.toggle('st-seg-on', s.dataset.stSport === _sport))
  card.querySelectorAll('.st-legend-row').forEach(r => r.classList.toggle('st-legend-on', r.dataset.stSport === _sport))
  document.getElementById('stDonutCenter').innerHTML = donutCenterHTML(_data)
}

// Drag across the timeline to scrub; touch-action: pan-y keeps vertical
// page scrolling working, so only sideways drags are captured
function _wireScrub() {
  const bars = document.getElementById('stTlBars')
  if (!bars) return
  const n = () => timelineSeries(_data).length
  const pick = e => {
    const r = bars.getBoundingClientRect()
    const i = Math.max(0, Math.min(n() - 1, Math.floor(((e.clientX - r.left) / r.width) * n())))
    if (i === _yearSel) return
    _yearSel = i
    _syncScrub()
  }
  let active = false
  bars.addEventListener('pointerdown', e => { active = true; pick(e) })
  bars.addEventListener('pointermove', e => { if (active || e.pointerType === 'mouse') pick(e) })
  const end = () => { active = false }
  bars.addEventListener('pointerup', end)
  bars.addEventListener('pointercancel', end)
  bars.addEventListener('pointerleave', e => {
    active = false
    if (e.pointerType === 'mouse') { _yearSel = null; _syncScrub() }
  })
  _syncScrub()
}

function _syncScrub() {
  const bars = document.getElementById('stTlBars')
  if (!bars) return
  const sel = _yearSel ?? _peakIndex(timelineSeries(_data))
  bars.querySelectorAll('.st-vbar').forEach((b, i) => b.classList.toggle('st-vbar-on', i === sel))
  const ro = document.getElementById('stTlReadout')
  if (ro) ro.innerHTML = readoutHTML(_data)
}
