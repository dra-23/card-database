import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController } from 'chart.js'
import * as state from '../state.js'
import { isOwned } from '../utils.js'

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, DoughnutController, BarController)

const PALETTE = ['#c2caf0', '#b6bef8', '#E8192C', '#6b7cde', '#dfe4fb', '#9fa8da', '#e8ecff', '#ef9a9a']
let _charts = []

export function renderStats() {
  if (!state.cardsLoaded || !state.playersLoaded) return

  const all    = state.ALL_CARDS
  const owned  = all.filter(c => isOwned(c))
  const wishlist = all.filter(c => !isOwned(c))
  const graded = all.filter(c => c['Grading Company'] && c['Grading Company'] !== 'Raw')

  // Destroy existing charts
  _charts.forEach(ch => ch.destroy())
  _charts = []

  document.getElementById('statsContent').innerHTML = `
    <div class="stats-content">
      <!-- Summary row -->
      <div class="stat-summary-row">
        <div class="stat-summary-card">
          <div class="stat-summary-num">${owned.length}</div>
          <div class="stat-summary-label">Owned</div>
        </div>
        <div class="stat-summary-card">
          <div class="stat-summary-num">${wishlist.length}</div>
          <div class="stat-summary-label">Wishlist</div>
        </div>
        <div class="stat-summary-card">
          <div class="stat-summary-num">${graded.length}</div>
          <div class="stat-summary-label">Graded</div>
        </div>
      </div>

      <!-- Owned vs Wishlist -->
      <div class="stat-card">
        <div class="stat-card-title">Owned vs Wishlist</div>
        <div class="chart-container" style="max-height:220px;"><canvas id="chartOwnedWishlist"></canvas></div>
      </div>

      <!-- By Sport -->
      <div class="stat-card">
        <div class="stat-card-title">By Sport</div>
        <div class="chart-container" style="max-height:220px;"><canvas id="chartSport"></canvas></div>
      </div>

      <!-- Top Players -->
      <div class="stat-card">
        <div class="stat-card-title">Top Players (owned)</div>
        <div class="chart-container" style="max-height:320px;"><canvas id="chartTopPlayers"></canvas></div>
      </div>

      <!-- Graded grades distribution -->
      ${graded.length > 0 ? `<div class="stat-card">
        <div class="stat-card-title">Grade Distribution</div>
        <div class="chart-container" style="max-height:220px;"><canvas id="chartGrades"></canvas></div>
      </div>` : ''}

      <!-- Cards by year -->
      <div class="stat-card">
        <div class="stat-card-title">Owned by Year</div>
        <div class="chart-container" style="max-height:240px;"><canvas id="chartYear"></canvas></div>
      </div>
    </div>
  `

  // Owned vs Wishlist donut
  _charts.push(new Chart(document.getElementById('chartOwnedWishlist'), {
    type: 'doughnut',
    data: {
      labels: ['Owned', 'Wishlist'],
      datasets: [{ data: [owned.length, wishlist.length], backgroundColor: ['#c2caf0', '#dfe4fb'], borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: true, cutout: '68%' },
  }))

  // By sport donut
  const sportMap = {}
  owned.forEach(c => { if (c.Sport) sportMap[c.Sport] = (sportMap[c.Sport] || 0) + 1 })
  const sportEntries = Object.entries(sportMap).sort((a, b) => b[1] - a[1])
  _charts.push(new Chart(document.getElementById('chartSport'), {
    type: 'doughnut',
    data: {
      labels: sportEntries.map(e => e[0]),
      datasets: [{ data: sportEntries.map(e => e[1]), backgroundColor: PALETTE.slice(0, sportEntries.length), borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: true, cutout: '68%' },
  }))

  // Top players bar (horizontal)
  const playerMap = {}
  owned.forEach(c => { if (c.Player) playerMap[c.Player] = (playerMap[c.Player] || 0) + 1 })
  const topPlayers = Object.entries(playerMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const playerLabels = topPlayers.map(([id]) => {
    const p = state.ALL_PLAYERS.find(pl => pl.id === id)
    return p?.Player || id
  })
  _charts.push(new Chart(document.getElementById('chartTopPlayers'), {
    type: 'bar',
    data: {
      labels: playerLabels,
      datasets: [{ data: topPlayers.map(e => e[1]), backgroundColor: '#c2caf0', borderRadius: 8 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { display: false } } },
      maintainAspectRatio: false,
    },
  }))

  // Grade distribution
  if (graded.length > 0) {
    const gradeMap = {}
    graded.forEach(c => {
      const g = parseFloat(c.Grade) || 0
      const label = Number.isInteger(g) ? String(g) : g.toFixed(1)
      gradeMap[label] = (gradeMap[label] || 0) + 1
    })
    const gradeEntries = Object.entries(gradeMap).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
    _charts.push(new Chart(document.getElementById('chartGrades'), {
      type: 'bar',
      data: {
        labels: gradeEntries.map(e => e[0]),
        datasets: [{ data: gradeEntries.map(e => e[1]), backgroundColor: '#b6bef8', borderRadius: 8 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { display: false }, ticks: { stepSize: 1 } } },
        maintainAspectRatio: true,
      },
    }))
  }

  // Owned by year bar
  const yearMap = {}
  owned.forEach(c => { if (c.Year) yearMap[c.Year] = (yearMap[c.Year] || 0) + 1 })
  const yearEntries = Object.entries(yearMap).sort((a, b) => a[0].localeCompare(b[0]))
  _charts.push(new Chart(document.getElementById('chartYear'), {
    type: 'bar',
    data: {
      labels: yearEntries.map(e => e[0]),
      datasets: [{ data: yearEntries.map(e => e[1]), backgroundColor: '#c2caf0', borderRadius: 6 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxRotation: 45, font: { size: 10 } }, grid: { display: false } },
        y: { grid: { display: false }, ticks: { stepSize: 1 } },
      },
      maintainAspectRatio: false,
    },
  }))
}
