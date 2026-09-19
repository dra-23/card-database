export function promptNotes(existing = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;'
    overlay.innerHTML = `
      <div style="background:var(--md-surface);border-radius:28px;padding:24px;width:100%;max-width:360px;">
        <div style="font-size:18px;font-weight:700;font-family:'Google Sans Display';margin-bottom:4px;">Notes</div>
        <div style="font-size:15px;color:var(--md-on-surface-variant);margin-bottom:16px;line-height:1.5;">Condition, provenance, or where you found this card.</div>
        <textarea id="_notesPromptInput" rows="4" placeholder="Add a note…"
          style="width:100%;resize:vertical;border:none;background:var(--md-surface-2);border-radius:12px;padding:12px 14px;font-size:15px;font-family:'Google Sans',sans-serif;color:var(--md-on-surface);outline:none;margin-bottom:20px;box-sizing:border-box;">${existing.replace(/</g, '&lt;')}</textarea>
        <div style="display:flex;gap:12px;">
          <button id="_notesCancel" style="flex:1;height:48px;border:none;border-radius:24px;background:var(--md-surface-2);font-family:'Google Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;color:var(--md-on-surface);">Cancel</button>
          <button id="_notesSave" style="flex:1;height:48px;border:none;border-radius:24px;background:var(--md-primary);color:#fff;font-family:'Google Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;">Save</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    const input = overlay.querySelector('#_notesPromptInput')
    setTimeout(() => { input.focus(); input.selectionStart = input.selectionEnd = input.value.length }, 50)

    function finish(value) {
      overlay.remove()
      resolve(value)
    }

    overlay.querySelector('#_notesCancel').onclick = () => finish(null)
    overlay.querySelector('#_notesSave').onclick   = () => finish(input.value.trim())
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) finish(null) })
  })
}
