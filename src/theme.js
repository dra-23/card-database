const KEY = 'sleevd-theme'

export function getThemePref() {
  return localStorage.getItem(KEY) || 'system'
}

export function applyTheme(pref) {
  const isDark = pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
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
