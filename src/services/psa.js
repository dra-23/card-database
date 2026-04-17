const BASE = 'https://api.psacard.com/publicapi'

async function psaFetch(path) {
  const KEY = import.meta.env.VITE_PSA_KEY
  if (!KEY) throw new Error('PSA API key not configured — add VITE_PSA_KEY to .env and rebuild')
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.Error || `PSA ${res.status}`)
  }
  return res.json()
}

export async function lookupCert(certNumber) {
  const cert = String(certNumber).replace(/\D/g, '')

  const [certRes, popRes, aprRes] = await Promise.allSettled([
    psaFetch(`/cert/GetByCertNumber/${cert}`),
    psaFetch(`/pop/GetPopulationByCertNumber/${cert}`),
    psaFetch(`/auctionprices/GetAuctionPricesByCertNumber/${cert}`),
  ])

  // Cert is mandatory — surface its error if it failed
  if (certRes.status === 'rejected') throw certRes.reason

  const certRaw = certRes.value ?? {}
  const popRaw  = popRes.status === 'fulfilled' ? (popRes.value ?? {}) : {}
  const aprRaw  = aprRes.status === 'fulfilled' ? (aprRes.value ?? {}) : {}

  console.log('[psa] cert:', JSON.stringify(certRaw))
  console.log('[psa] pop:', JSON.stringify(popRaw))
  console.log('[psa] apr:', JSON.stringify(aprRaw))

  const certData = certRaw.PSACert ?? certRaw

  // Population: cert endpoint often includes TotalPopulation; fall back to pop endpoint
  const popData = popRaw.PSACert ?? popRaw
  const pop = certData.TotalPopulation
    ?? popData.TotalPop
    ?? popData.TotalPopulation
    ?? popData.Total
    ?? popData.Pop
    ?? null

  // APR: array may be at root or under AuctionPrices key
  const aprList = Array.isArray(aprRaw) ? aprRaw
    : (aprRaw.AuctionPrices ?? aprRaw.PSAAuctionPrices ?? [])

  const lastSale = aprList.length
    ? [...aprList].sort((a, b) => new Date(b.SaleDate) - new Date(a.SaleDate))[0]
    : null

  return {
    cert,
    grade:    certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? null,
    pop,
    lastSold: lastSale?.SalePrice ?? lastSale?.Price ?? null,
  }
}
