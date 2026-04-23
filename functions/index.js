const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

initializeApp()

const PSA_BASE = 'https://api.psacard.com/publicapi'

async function psaGet(key, path) {
  const res = await fetch(`${PSA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`PSA ${res.status} — ${path}`)
  return res.json()
}

exports.psalookup = onRequest({ region: 'us-central1', maxInstances: 5 }, async (req, res) => {
  // Require a valid Firebase ID token — rejects all unauthenticated callers
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    await getAuth().verifyIdToken(idToken)
  } catch (_) {
    res.status(401).json({ error: 'Invalid token' }); return
  }

  const cert = String(req.query.cert || '').replace(/\D/g, '')
  if (!cert) { res.status(400).json({ error: 'cert query param required' }); return }

  const KEY = process.env.PSA_KEY
  if (!KEY) { res.status(500).json({ error: 'PSA_KEY not set in functions environment' }); return }

  try {
    const [certRaw, imgRaw] = await Promise.allSettled([
      psaGet(KEY, `/cert/GetByCertNumber/${cert}`),
      psaGet(KEY, `/cert/GetImagesByCertNumber/${cert}`),
    ])

    if (certRaw.status === 'rejected') throw new Error(certRaw.reason?.message || 'Cert lookup failed')
    const certData = certRaw.value.PSACert ?? certRaw.value

    const grade = certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? null
    const pop   = certData.TotalPopulation ?? null

    let frontImage = null
    if (imgRaw.status === 'fulfilled') {
      const imgs = imgRaw.value
      if (Array.isArray(imgs)) {
        const front = imgs.find(i => i.IsFrontImage) ?? imgs[0]
        frontImage = front?.ImageURL ?? null
      } else {
        frontImage = imgs.FrontImageURL ?? imgs.ImageFront ?? imgs.FrontImage ?? null
      }
    }

    res.json({ cert, grade, pop, frontImage })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
