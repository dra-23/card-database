export async function lookupCert(certNumber) {
  const cert = String(certNumber).replace(/\D/g, '')
  const res  = await fetch(`/api/psa?cert=${cert}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `PSA lookup failed (${res.status})`)
  }
  return res.json()
}
