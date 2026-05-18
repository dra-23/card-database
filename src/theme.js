const KEY = 'sleevd-theme'

export function getThemePref() {
  return localStorage.getItem(KEY) || 'system'
}

export function applyTheme(pref) {
  const isDark = pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = isDark ? '#13141E' : '#c2caf0'
}

export function setThemePref(pref) {
  localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

export function initTheme() {
  applyTheme(getThemePref())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system')
  })
}
