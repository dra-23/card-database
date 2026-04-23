import { auth } from '../firebase.js'

export async function lookupCert(certNumber) {
  const cert = String(certNumber).replace(/\D/g, '')
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Not signed in')
  const res = await fetch(`/api/psa?cert=${cert}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `PSA lookup failed (${res.status})`)
  }
  return res.json()
}
