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

    const grade = certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? null
    const pop   = certData.TotalPopulation ?? null

    res.json({ cert, grade, pop })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
