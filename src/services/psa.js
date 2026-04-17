const BASE = 'https://api.psacard.com/publicapi'

async function psaFetch(path) {
  const KEY = import.meta.env.VITE_PSA_KEY
  if (!KEY) throw new Error('PSA API key not configured')
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

  console.log('[psa] cert:', certRes.value, 'pop:', popRes.value, 'apr:', aprRes.value)

  const certData = certRes.value?.PSACert ?? {}
  const popData  = popRes.value?.PSACert  ?? {}
  const aprList  = aprRes.value?.AuctionPrices ?? []

  const lastSale = aprList.length
    ? [...aprList].sort((a, b) => new Date(b.SaleDate) - new Date(a.SaleDate))[0]
    : null

  return {
    cert:     cert,
    grade:    certData.PSAGrade ?? null,
    pop:      popData.TotalPop ?? popData.TotalPopulation ?? popData.Total ?? null,
    lastSold: lastSale?.SalePrice ?? lastSale?.Price ?? null,
  }
}
