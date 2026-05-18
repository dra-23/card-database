export function promptPrice() {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;'
    overlay.innerHTML = `
      <div style="background:var(--md-surface);border-radius:28px;padding:24px;width:100%;max-width:320px;">
        <div style="font-size:18px;font-weight:700;font-family:'Google Sans Display';margin-bottom:4px;">What did you pay?</div>
        <div style="font-size:14px;color:var(--md-on-surface-variant);margin-bottom:16px;line-height:1.5;">Optionally record the purchase price.</div>
        <div style="background:var(--md-surface-2);border-radius:12px;padding:0 16px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;font-weight:700;color:var(--md-on-surface-variant);">$</span>
          <input id="_pricePromptInput" type="text" inputmode="decimal" placeholder="0.00"
            style="border:none;background:transparent;font-size:18px;font-family:'Roboto',sans-serif;color:var(--md-on-surface);width:100%;outline:none;padding:14px 0;">
        </div>
        <div style="display:flex;gap:12px;">
          <button id="_priceSkip" style="flex:1;height:48px;border:none;border-radius:24px;background:var(--md-surface-2);font-family:'Google Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;color:var(--md-on-surface);">Skip</button>
          <button id="_priceSave" style="flex:1;height:48px;border:none;border-radius:24px;background:#3D5AFE;color:#fff;font-family:'Google Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;">Mark Sleevd</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    const input = overlay.querySelector('#_pricePromptInput')
    setTimeout(() => input.focus(), 50)

    function finish(price) {
      overlay.remove()
      resolve(price)
    }

    overlay.querySelector('#_priceSkip').onclick = () => finish(null)
    overlay.querySelector('#_priceSave').onclick = () => {
      const val = parseFloat(input.value)
      finish(isNaN(val) ? null : val)
    }
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = parseFloat(input.value)
        finish(isNaN(val) ? null : val)
      }
    })
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) finish(null) })
  })
}
