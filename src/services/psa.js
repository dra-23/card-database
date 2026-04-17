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

  if (certRes.status === 'rejected') throw certRes.reason

  const certRaw = certRes.value ?? {}
  const popRaw  = popRes.status === 'fulfilled' ? (popRes.value ?? {}) : {}
  const aprRaw  = aprRes.status === 'fulfilled' ? (aprRes.value ?? {}) : {}

  const certData = certRaw.PSACert ?? certRaw

  // Population
  const popData = popRaw.PSACert ?? popRaw
  const pop = certData.TotalPopulation
    ?? popData.TotalPop ?? popData.TotalPopulation ?? popData.Total ?? popData.Pop
    ?? null

  // APR
  const aprList = Array.isArray(aprRaw) ? aprRaw
    : (aprRaw.AuctionPrices ?? aprRaw.PSAAuctionPrices ?? [])
  const lastSale = aprList.length
    ? [...aprList].sort((a, b) => new Date(b.SaleDate) - new Date(a.SaleDate))[0]
    : null

  // SMR price estimate — uses SpecID from cert, matched to this card's numeric grade
  let smrValue = null
  const specId  = certData.SpecID
  const gradeStr = certData.CardGrade ?? certData.PSAGrade ?? ''
  const gradeNum = parseFloat(gradeStr.match(/[\d.]+$/)?.[0])

  if (specId) {
    try {
      const smrRaw = await psaFetch(`/smrpriceguide/GetSMRPriceGuideItemBySpec/${specId}`)
      console.log('[psa] smr:', JSON.stringify(smrRaw))

      // SMR returns an array of grade/value entries; find our grade
      const items = Array.isArray(smrRaw) ? smrRaw
        : (smrRaw.SMRPriceGuideItem ?? smrRaw.Items ?? smrRaw.PriceGuideItems ?? [])

      if (items.length && !isNaN(gradeNum)) {
        const match = items.find(i => parseFloat(i.Grade ?? i.PSAGrade ?? i.GradeID) === gradeNum)
          ?? items.find(i => String(i.Grade ?? i.PSAGrade ?? '').includes(String(gradeNum)))
        smrValue = match?.Value ?? match?.Price ?? match?.SMRValue ?? match?.AveragePrice ?? null
      }

      // Fallback: if response is a single object (not array)
      if (smrValue == null && !Array.isArray(smrRaw)) {
        const obj = smrRaw.SMRPriceGuideItem ?? smrRaw
        smrValue = obj[`Grade${gradeNum}`] ?? obj[`PSA${gradeNum}`] ?? null
      }
    } catch (e) {
      console.warn('[psa] smr lookup failed:', e.message)
    }
  }

  return {
    cert,
    grade:    gradeStr || null,
    pop,
    lastSold: lastSale?.SalePrice ?? lastSale?.Price ?? null,
    smrValue,
  }
}
