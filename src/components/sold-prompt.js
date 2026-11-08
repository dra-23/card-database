import { db, doc, setDoc } from '../firebase.js'
import * as state from '../state.js'
import { isSold, confirmDialog } from '../utils.js'
import { showUndo } from './undo-bar.js'

// The sale fields as they are now, to put back on Undo
const saleFields = c => ({ Sold: isSold(c), SoldPrice: c.SoldPrice ?? '', SoldDate: c.SoldDate ?? '' })

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Asks for the sale price and date. Resolves { price, date } (price may be
// null when left blank) or null if cancelled.
export function promptSale(card) {
  return new Promise(resolve => {
    const paid = parseFloat(card?.Price)
    const editing = isSold(card || {})
    const prevPrice = editing && card.SoldPrice !== '' && card.SoldPrice != null ? String(card.SoldPrice) : ''
    const prevDate  = editing && /^\d{4}-\d{2}-\d{2}$/.test(card.SoldDate || '') ? card.SoldDate : todayISO()
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;'
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_soldTitle" style="background:var(--md-surface);border-radius:28px;padding:24px;width:100%;max-width:320px;">
        <div id="_soldTitle" style="font-size:18px;font-weight:700;font-family:'Google Sans Display';margin-bottom:4px;">${editing ? 'Edit Sale' : 'Mark as Sold'}</div>
        <div style="font-size:17px;color:var(--md-on-surface-variant);margin-bottom:16px;line-height:1.5;">What did it sell for?${paid > 0 ? ` You paid $${paid.toFixed(2)}.` : ''}</div>
        <label style="display:block;font-size:13px;font-weight:600;color:var(--md-on-surface-variant);margin:0 0 6px 4px;" for="_soldPriceInput">Sale price</label>
        <div style="background:var(--md-surface-2);border-radius:12px;padding:0 16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;font-weight:700;color:var(--md-on-surface-variant);">$</span>
          <input id="_soldPriceInput" type="text" inputmode="decimal" placeholder="0.00" value="${prevPrice.replace(/"/g, '')}"
            style="border:none;background:transparent;font-size:18px;font-family:'Roboto',sans-serif;color:var(--md-on-surface);width:100%;outline:none;padding:14px 0;">
        </div>
        <label style="display:block;font-size:13px;font-weight:600;color:var(--md-on-surface-variant);margin:0 0 6px 4px;" for="_soldDateInput">Date sold</label>
        <div style="background:var(--md-surface-2);border-radius:12px;padding:0 16px;margin-bottom:20px;">
          <input id="_soldDateInput" type="date" value="${prevDate}"
            style="border:none;background:transparent;font-size:17px;font-family:'Roboto',sans-serif;color:var(--md-on-surface);width:100%;outline:none;padding:13px 0;color-scheme:light dark;">
        </div>
        <div style="display:flex;gap:12px;">
          <button id="_soldCancel" style="flex:1;height:48px;border:none;border-radius:24px;background:var(--md-surface-2);font-family:'Google Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;color:var(--md-on-surface);">Cancel</button>
          <button id="_soldSave" style="flex:1;height:48px;border:none;border-radius:24px;background:#6D4C41;color:#fff;font-family:'Google Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;">${editing ? 'Save' : 'Mark Sold'}</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    const priceInput = overlay.querySelector('#_soldPriceInput')
    const dateInput  = overlay.querySelector('#_soldDateInput')
    setTimeout(() => priceInput.focus(), 50)

    function finish(result) {
      overlay.remove()
      resolve(result)
    }
    const save = () => {
      const val = parseFloat(String(priceInput.value).replace(/[$,]/g, ''))
      finish({ price: isNaN(val) ? null : val, date: dateInput.value || todayISO() })
    }

    overlay.querySelector('#_soldCancel').onclick = () => finish(null)
    overlay.querySelector('#_soldSave').onclick = save
    priceInput.addEventListener('keydown', e => { if (e.key === 'Enter') save() })
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') finish(null) })
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) finish(null) })
  })
}

// Prompts for the sale and saves it. Owned is left as-is so undoing the sale
// puts the card back exactly where it was.
export async function markCardSold(cardId) {
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card) return false
  const sale = await promptSale(card)
  if (!sale) return false
  const before = saleFields(card)
  const wasSold = before.Sold
  await setDoc(doc(db, 'Cards', cardId), {
    Sold: true,
    SoldPrice: sale.price != null ? String(sale.price) : '',
    SoldDate: sale.date,
  }, { merge: true })
  showUndo(wasSold ? 'Sale updated' : 'Marked as sold', () => setDoc(doc(db, 'Cards', cardId), before, { merge: true }))
  return true
}

// No confirm by default: the Undo bar covers a mis-tap
export async function unmarkCardSold(cardId, { confirm = false } = {}) {
  const card = state.ALL_CARDS.find(c => c.id === cardId)
  if (!card || !isSold(card)) return false
  if (confirm) {
    const ok = await confirmDialog({
      title: 'Undo sale?',
      body: 'This card goes back into your collection and its sale price and date are cleared.',
      confirmLabel: 'Undo sale',
      danger: false,
    })
    if (!ok) return false
  }
  const before = saleFields(card)
  await setDoc(doc(db, 'Cards', cardId), { Sold: false, SoldPrice: '', SoldDate: '' }, { merge: true })
  showUndo('Sale removed', () => setDoc(doc(db, 'Cards', cardId), before, { merge: true }))
  return true
}
