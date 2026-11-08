// Snackbar with an Undo action, shown briefly after a reversible change
// (mark sold, undo sale, delete). One at a time: a new one replaces the last.
let _current = null

export function showUndo(message, onUndo, { timeout = 6000 } = {}) {
  _current?.dismiss()

  const bar = document.createElement('div')
  bar.className = 'undo-bar'
  bar.setAttribute('role', 'status')
  bar.setAttribute('aria-live', 'polite')
  const text = document.createElement('span')
  text.className = 'undo-bar-text'
  text.textContent = message
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'undo-bar-btn'
  btn.textContent = 'Undo'
  bar.append(text, btn)
  document.body.appendChild(bar)
  requestAnimationFrame(() => bar.classList.add('show'))

  let timer = null
  const self = {
    dismiss() {
      clearTimeout(timer)
      if (_current === self) _current = null
      bar.classList.remove('show')
      setTimeout(() => bar.remove(), 250)
    },
  }
  _current = self

  // Pause the countdown while the pointer is over it (desktop)
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => self.dismiss(), timeout) }
  bar.addEventListener('pointerenter', () => clearTimeout(timer))
  bar.addEventListener('pointerleave', arm)
  arm()

  btn.addEventListener('click', async () => {
    self.dismiss()
    try { await onUndo() } catch (e) { console.error('[undo]', e) }
  })
  return self
}
