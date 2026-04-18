const { onRequest } = require('firebase-functions/v2/https')

const PSA_BASE = 'https://api.psacard.com/publicapi'

async function psaGet(key, path) {
  const res = await fetch(`${PSA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`PSA ${res.status} — ${path}`)
  return res.json()
}

exports.psalookup = onRequest({ region: 'us-central1' }, async (req, res) => {
  const cert = String(req.query.cert || '').replace(/\D/g, '')
  if (!cert) { res.status(400).json({ error: 'cert query param required' }); return }

  const KEY = process.env.PSA_KEY
  if (!KEY) { res.status(500).json({ error: 'PSA_KEY not set in functions environment' }); return }

  try {
    const certRaw  = await psaGet(KEY, `/cert/GetByCertNumber/${cert}`)
    const certData = certRaw.PSACert ?? certRaw

    const gradeStr = certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? ''
    const gradeNum = parseFloat(gradeStr.match(/[\d.]+$/)?.[0])
    const pop      = certData.TotalPopulation ?? null

    let smrValue = null
    for (const id of [certData.SpecNumber, certData.SpecID]) {
      if (!id || smrValue != null) continue
      try {
        const smrRaw = await psaGet(KEY, `/smrpriceguide/GetSMRPriceGuideItemBySpec/${id}`)
        const items  = Array.isArray(smrRaw) ? smrRaw
          : (smrRaw.SMRPriceGuideItem ?? smrRaw.Items ?? smrRaw.PriceGuideItems ?? [])

        if (items.length && !isNaN(gradeNum)) {
          const match = items.find(i => parseFloat(i.Grade ?? i.GradeID ?? i.PSAGrade) === gradeNum)
            ?? items.find(i => String(i.Grade ?? '').includes(String(gradeNum)))
          smrValue = match?.Value ?? match?.Price ?? match?.SMRValue ?? match?.AveragePrice ?? null
        }
        if (smrValue == null && !Array.isArray(smrRaw) && !isNaN(gradeNum)) {
          const obj = smrRaw.SMRPriceGuideItem ?? smrRaw
          smrValue  = obj[`Grade${gradeNum}`] ?? obj[`PSA${gradeNum}`] ?? null
        }
      } catch (_) { /* SMR is optional */ }
    }

    res.json({ cert, grade: gradeStr || null, pop, smrValue, lastSold: null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
