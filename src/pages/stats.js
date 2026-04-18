import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from 'chart.js'
import * as state from '../state.js'
import { isOwned } from '../utils.js'

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController)

// Brand palette
const C_PRIMARY  = '#E8192C'
const C_BLUE     = '#3D5AFE'
const C_SURFACE1 = '#c2caf0'
const C_SURFACE2 = '#dfe4fb'
const C_GOLD     = '#B8860B'
const C_MEM      = '#1565C0'
const C_SILVER   = '#78909C'
const C_GREEN    = '#2E7D32'

const SPORT_COLORS = {
  Baseball:   '#1565C0',
  Basketball: '#E8192C',
  Football:   '#2E7D32',
  Hockey:     '#00838F',
  Golf:       '#558B2F',
  Soccer:     '#F57F17',
}

let _charts = []

function mkChart(id, cfg) {
  const el = document.getElementById(id)
  if (!el) return
  _charts.push(new Chart(el, cfg))
}

export function renderStats() {
  if (!state.cardsLoaded || !state.playersLoaded) return

  const all      = state.ALL_CARDS
  const owned    = all.filter(c => isOwned(c))
  const wishlist = all.filter(c => !isOwned(c))
  const graded   = owned.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')

  // Badge counts (across owned)
  const rcCount       = owned.filter(c => c.RC       === true || c.RC       === 'true').length
  const autoCount     = owned.filter(c => c.Auto     === true || c.Auto     === 'true').length
  const memCount      = owned.filter(c => c.Mem === true || c.Mem === 'true' || c.Patch === true || c.Patch === 'true').length
  const numberedCount = owned.filter(c => c.Numbered === true || c.Numbered === 'true').length

  // Total value
  const totalValue = owned.reduce((sum, c) => sum + (parseFloat(c.Price) || 0), 0)

  // Destroy old charts
  _charts.forEach(ch => ch.destroy())
  _charts = []

  document.getElementById('statsContent').innerHTML = `
    <div class="stats-content">

      <!-- Summary row — styled like badge breakdown -->
      <div class="stat-card">
        <div class="stat-card-title">Collection Overview</div>
        <div class="stat-badge-grid">
          <div class="stat-badge-item" style="--badge-color:#3D5AFE;">
            <span class="stat-badge-chip" style="background:#3D5AFE;">sleevd</span>
            <div class="stat-badge-count">${owned.length}</div>
            <div class="stat-badge-label">In Collection</div>
          </div>
          <div class="stat-badge-item" style="--badge-color:${C_SILVER};">
            <span class="stat-badge-chip" style="background:${C_SILVER};">unsleevd</span>
            <div class="stat-badge-count">${wishlist.length}</div>
            <div class="stat-badge-label">Wishlist</div>
          </div>
          <div class="stat-badge-item" style="--badge-color:${C_GREEN};">
            <span class="stat-badge-chip" style="background:${C_GREEN};">GRADED</span>
            <div class="stat-badge-count">${graded.length}</div>
            <div class="stat-badge-label">Graded</div>
          </div>
          ${totalValue > 0 ? `
          <div class="stat-badge-item" style="--badge-color:${C_GOLD};">
            <span class="stat-badge-chip" style="background:${C_GOLD};">PAID</span>
            <div class="stat-badge-count" style="font-size:18px;">$${totalValue % 1 === 0 ? totalValue : totalValue.toFixed(0)}</div>
            <div class="stat-badge-label">Total Paid</div>
          </div>` : ''}
        </div>
      </div>

      <!-- Badge Breakdown -->
      ${(rcCount + autoCount + memCount + numberedCount) > 0 ? `
      <div class="stat-card">
        <div class="stat-card-title">Badge Breakdown</div>
        <div class="stat-badge-grid">
          <div class="stat-badge-item" style="--badge-color:#E8192C;">
            <span class="stat-badge-chip">RC</span>
            <div class="stat-badge-count">${rcCount}</div>
            <div class="stat-badge-label">Rookie</div>
          </div>
          <div class="stat-badge-item" style="--badge-color:${C_GOLD};">
            <span class="stat-badge-chip" style="background:${C_GOLD};">AUTO</span>
            <div class="stat-badge-count">${autoCount}</div>
            <div class="stat-badge-label">Autograph</div>
          </div>
          <div class="stat-badge-item" style="--badge-color:${C_MEM};">
            <span class="stat-badge-chip" style="background:${C_MEM};">MEM</span>
            <div class="stat-badge-count">${memCount}</div>
            <div class="stat-badge-label">Memorabilia</div>
          </div>
          <div class="stat-badge-item" style="--badge-color:${C_SILVER};">
            <span class="stat-badge-chip" style="background:${C_SILVER};">#'d</span>
            <div class="stat-badge-count">${numberedCount}</div>
            <div class="stat-badge-label">Numbered</div>
          </div>
        </div>
      </div>` : ''}

      <!-- By Sport + Top Players (side-by-side on desktop) -->
      <div class="stats-row-2col">

        <div class="stat-card">
          <div class="stat-card-title">Owned by Sport</div>
          <div class="chart-container" style="height:180px;"><canvas id="chartSport"></canvas></div>
        </div>

        <div class="stat-card">
          <div class="stat-card-title">Top Players</div>
          <div class="chart-container" style="height:400px;"><canvas id="chartTopPlayers"></canvas></div>
        </div>

      </div>

      <!-- Owned by Year -->
      <div class="stat-card">
        <div class="stat-card-title">Owned by Year</div>
        <div class="chart-container" style="height:300px;"><canvas id="chartYear"></canvas></div>
      </div>

      <!-- Grade Distribution (only if graded cards exist) -->
      ${graded.length > 0 ? `
      <div class="stat-card">
        <div class="stat-card-title">Grade Distribution</div>
        <div class="chart-container" style="max-height:220px;"><canvas id="chartGrades"></canvas></div>
      </div>` : ''}

    </div>
  `

  // By Sport — donut with brand colors
  const sportMap = {}
  owned.forEach(c => { if (c.Sport) sportMap[c.Sport] = (sportMap[c.Sport] || 0) + 1 })
  const sportEntries = Object.entries(sportMap).sort((a, b) => b[1] - a[1])
  if (sportEntries.length > 0) {
    mkChart('chartSport', {
      type: 'doughnut',
      data: {
        labels: sportEntries.map(e => e[0]),
        datasets: [{
          data: sportEntries.map(e => e[1]),
          backgroundColor: sportEntries.map(e => SPORT_COLORS[e[0]] || C_SURFACE1),
          borderWidth: 0,
        }],
      },
      options: {
        plugins: { legend: { position: 'left', labels: { padding: 14, font: { size: 12 }, boxWidth: 12, boxHeight: 12 } } },
        maintainAspectRatio: false,
        cutout: '65%',
      },
    })
  }

  // Top Players — horizontal bar
  const playerMap = {}
  owned.forEach(c => { if (c.Player) playerMap[c.Player] = (playerMap[c.Player] || 0) + 1 })
  const topPlayers = Object.entries(playerMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const playerLabels = topPlayers.map(([id]) => {
    const p = state.ALL_PLAYERS.find(pl => pl.id === id)
    return p?.Player || id
  })
  if (topPlayers.length > 0) {
    mkChart('chartTopPlayers', {
      type: 'bar',
      data: {
        labels: playerLabels,
        datasets: [{
          data: topPlayers.map(e => e[1]),
          backgroundColor: C_SURFACE1,
          hoverBackgroundColor: C_PRIMARY,
          borderRadius: 8,
        }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, stepSize: 1 } },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } },
        },
        maintainAspectRatio: false,
      },
    })
  }

  // Owned by Year — vertical bar
  const yearMap = {}
  owned.forEach(c => { if (c.Year) yearMap[c.Year] = (yearMap[c.Year] || 0) + 1 })
  const yearEntries = Object.entries(yearMap).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  if (yearEntries.length > 0) {
    mkChart('chartYear', {
      type: 'bar',
      data: {
        labels: yearEntries.map(e => e[0]),
        datasets: [{
          data: yearEntries.map(e => e[1]),
          backgroundColor: C_SURFACE1,
          hoverBackgroundColor: C_BLUE,
          borderRadius: 6,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
        maintainAspectRatio: false,
      },
    })
  }

  // Grade Distribution
  if (graded.length > 0) {
    const gradeMap = {}
    graded.forEach(c => {
      const g = parseFloat(c.Grade)
      if (isNaN(g)) return
      const label = Number.isInteger(g) ? String(g) : g.toFixed(1)
      gradeMap[label] = (gradeMap[label] || 0) + 1
    })
    const gradeEntries = Object.entries(gradeMap).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    const gradeColors = gradeEntries.map(([g]) => {
      const v = parseFloat(g)
      if (v >= 9) return C_GREEN
      if (v >= 7) return C_BLUE
      if (v >= 5) return C_GOLD
      return C_PRIMARY
    })
    mkChart('chartGrades', {
      type: 'bar',
      data: {
        labels: gradeEntries.map(e => e[0]),
        datasets: [{
          data: gradeEntries.map(e => e[1]),
          backgroundColor: gradeColors,
          borderRadius: 8,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1, font: { size: 11 } } },
        },
        maintainAspectRatio: false,
      },
    })
  }
}
