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

  // Cert is the primary source — pop lives inside it (TotalPopulation)
  const certRaw = await psaFetch(`/cert/GetByCertNumber/${cert}`)
  const certData = certRaw.PSACert ?? certRaw

  console.log('[psa] cert:', JSON.stringify(certData))

  const gradeStr = certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? ''
  const gradeNum = parseFloat(gradeStr.match(/[\d.]+$/)?.[0])
  const pop      = certData.TotalPopulation ?? null

  // SMR price estimate — try SpecNumber first, fall back to SpecID
  let smrValue = null
  const specNumber = certData.SpecNumber
  const specId     = certData.SpecID

  for (const id of [specNumber, specId]) {
    if (!id || smrValue != null) continue
    try {
      const smrRaw = await psaFetch(`/smrpriceguide/GetSMRPriceGuideItemBySpec/${id}`)
      console.log('[psa] smr raw:', JSON.stringify(smrRaw))

      const items = Array.isArray(smrRaw) ? smrRaw
        : (smrRaw.SMRPriceGuideItem ?? smrRaw.Items ?? smrRaw.PriceGuideItems ?? [])

      if (items.length && !isNaN(gradeNum)) {
        const match = items.find(i => parseFloat(i.Grade ?? i.GradeID ?? i.PSAGrade) === gradeNum)
          ?? items.find(i => String(i.Grade ?? i.GradeID ?? '').includes(String(gradeNum)))
        smrValue = match?.Value ?? match?.Price ?? match?.SMRValue ?? match?.AveragePrice ?? null
      }

      // If response is a flat object with grade keys like "Grade8", "PSA8"
      if (smrValue == null && !Array.isArray(smrRaw) && !isNaN(gradeNum)) {
        const obj = smrRaw.SMRPriceGuideItem ?? smrRaw
        smrValue = obj[`Grade${gradeNum}`] ?? obj[`PSA${gradeNum}`] ?? obj[`G${gradeNum}`] ?? null
      }
    } catch (e) {
      console.warn(`[psa] smr failed for id ${id}:`, e.message)
    }
  }

  return {
    cert,
    grade:    gradeStr || null,
    pop,
    smrValue,
    lastSold: null, // APR endpoint not available on this API tier
  }
}
