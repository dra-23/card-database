export function openLightbox(src) {
  document.getElementById('imgLightboxImg').src = src
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
  document.getElementById('imgLightboxClose').addEventListener('click', () => {
    history.back()
  })
  document.getElementById('imgLightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) history.back()
  })
}
