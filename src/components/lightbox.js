let _srcs = []
let _idx  = 0

function _render() {
  document.getElementById('imgLightboxImg').src = _srcs[_idx]
  const prev    = document.getElementById('imgLightboxPrev')
  const next    = document.getElementById('imgLightboxNext')
  const counter = document.getElementById('imgLightboxCounter')
  const multi   = _srcs.length > 1
  if (prev)    prev.style.display    = multi && _idx > 0                  ? 'flex' : 'none'
  if (next)    next.style.display    = multi && _idx < _srcs.length - 1   ? 'flex' : 'none'
  if (counter) counter.textContent   = multi ? `${_idx + 1} / ${_srcs.length}` : ''
}

export function openLightbox(srcs, startIdx = 0) {
  _srcs = Array.isArray(srcs) ? srcs : [srcs]
  _idx  = startIdx
  _render()
  document.getElementById('imgLightbox').classList.add('open')
  history.pushState({ v: 'lightbox' }, '')
}

export function closeLightbox() {
  const lb = document.getElementById('imgLightbox')
  if (!lb.classList.contains('open')) return
  lb.classList.remove('open')
}

export function isLightboxOpen() {
  return document.getElementById('imgLightbox')?.classList.contains('open') ?? false
}

export function initLightbox() {
  document.getElementById('imgLightboxClose').addEventListener('click', () => history.back())

  document.getElementById('imgLightboxPrev').addEventListener('click', e => {
    e.stopPropagation()
    if (_idx > 0) { _idx--; _render() }
  })

  document.getElementById('imgLightboxNext').addEventListener('click', e => {
    e.stopPropagation()
    if (_idx < _srcs.length - 1) { _idx++; _render() }
  })

  document.getElementById('imgLightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) history.back()
  })

  document.addEventListener('keydown', e => {
    if (!isLightboxOpen()) return
    if (e.key === 'ArrowLeft'  && _idx > 0)                { _idx--; _render() }
    if (e.key === 'ArrowRight' && _idx < _srcs.length - 1) { _idx++; _render() }
    if (e.key === 'Escape') history.back()
  })
}
