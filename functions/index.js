const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

initializeApp()

const CARDSIGHT_API_KEY = defineSecret('CARDSIGHT_API_KEY')
const PSA_KEY = defineSecret('PSA_KEY')
const CARDSIGHT_BASE = 'https://api.cardsight.ai'
// Same single account firestore.rules and storage.rules allow — any Google
// account can sign in, so a valid ID token alone isn't enough to gate a
// paid API.
const OWNER_UID = 'DjH4LhcGElM4O1cqM6ZBSmIlhBX2'
// Only the endpoints the app actually calls, so this can't be used as a
// general-purpose relay for the rest of the Cardsight API.
const CARDSIGHT_ALLOWED = [
  { method: 'GET',  path: /^\/v1\/catalog\/search$/ },
  { method: 'GET',  path: /^\/v1\/catalog\/cards\/[\w-]+$/ },
  { method: 'GET',  path: /^\/v1\/pricing\/[\w-]+$/ },
  { method: 'GET',  path: /^\/v1\/images\/cards\/[\w-]+$/ },
  { method: 'POST', path: /^\/v1\/identify\/card$/ },
]

exports.cardsight = onRequest({ region: 'us-central1', maxInstances: 5, secrets: [CARDSIGHT_API_KEY] }, async (req, res) => {
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) { res.status(401).json({ error: 'Unauthorized' }); return }
  let decoded
  try {
    decoded = await getAuth().verifyIdToken(idToken)
  } catch (_) {
    res.status(401).json({ error: 'Invalid token' }); return
  }
  if (decoded.uid !== OWNER_UID) { res.status(403).json({ error: 'Forbidden' }); return }

  // Reached via the Hosting rewrite as /api/cardsight/v1/..., or directly as /v1/...
  const path = req.path.replace(/^\/api\/cardsight/, '')
  if (!CARDSIGHT_ALLOWED.some(a => a.method === req.method && a.path.test(path))) {
    res.status(404).json({ error: 'Not found' }); return
  }

  const qIdx = req.originalUrl.indexOf('?')
  const query = qIdx >= 0 ? req.originalUrl.slice(qIdx) : ''
  const headers = { 'X-API-Key': CARDSIGHT_API_KEY.value() }
  const init = { method: req.method, headers }
  if (req.method === 'POST') {
    // Multipart image upload for identify — forwarded byte-for-byte.
    headers['Content-Type'] = req.headers['content-type']
    init.body = req.rawBody
  }

  try {
    const upstream = await fetch(`${CARDSIGHT_BASE}${path}${query}`, init)
    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.set('Content-Type', contentType)
    // Authenticated per-user data — keep it out of the Hosting CDN cache.
    res.set('Cache-Control', 'private, no-store')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

const PSA_BASE = 'https://api.psacard.com/publicapi'

async function psaGet(key, path) {
  const res = await fetch(`${PSA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`PSA ${res.status} — ${path}`)
  return res.json()
}

function extractImages(raw) {
  if (!raw) return { frontImage: null, backImage: null }
  const obj = raw.PSACert ?? raw

  if (Array.isArray(obj)) {
    const front = obj.find(i => i.IsFrontImage) ?? obj[0]
    const back  = obj.find(i => !i.IsFrontImage && i !== front) ?? null
    return {
      frontImage: front?.ImageURL ?? front?.FrontImageURL ?? null,
      backImage:  back?.ImageURL  ?? back?.BackImageURL   ?? null,
    }
  }

  return {
    frontImage: obj.FrontImageURL ?? obj.ImageFront ?? obj.FrontImage ?? obj.ImageURL ?? null,
    backImage:  obj.BackImageURL  ?? obj.ImageBack  ?? obj.BackImage  ?? null,
  }
}

exports.psalookup = onRequest({ region: 'us-central1', maxInstances: 5, secrets: [PSA_KEY] }, async (req, res) => {
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!idToken) { res.status(401).json({ error: 'Unauthorized' }); return }
  let decoded
  try {
    decoded = await getAuth().verifyIdToken(idToken)
  } catch (_) {
    res.status(401).json({ error: 'Invalid token' }); return
  }
  if (decoded.uid !== OWNER_UID) { res.status(403).json({ error: 'Forbidden' }); return }

  const cert = String(req.query.cert || '').replace(/\D/g, '')
  if (!cert) { res.status(400).json({ error: 'cert query param required' }); return }

  const KEY = PSA_KEY.value()

  try {
    const [certRaw, imgRaw] = await Promise.allSettled([
      psaGet(KEY, `/cert/GetByCertNumber/${cert}`),
      psaGet(KEY, `/cert/GetImagesByCertNumber/${cert}`),
    ])

    if (certRaw.status === 'rejected') throw new Error(certRaw.reason?.message || 'Cert lookup failed')
    const certData = certRaw.value.PSACert ?? certRaw.value

    const grade = certData.CardGrade ?? certData.PSAGrade ?? certData.GradeDescription ?? null
    const pop   = certData.TotalPopulation ?? null

    const imgPayload = imgRaw.status === 'fulfilled' ? imgRaw.value : null
    console.log('PSA image raw response:', JSON.stringify(imgPayload))

    const { frontImage, backImage } = extractImages(imgPayload)
    const resolvedFront = frontImage ?? certData.FrontImageURL ?? certData.ImageFront ?? certData.FrontImage ?? null
    const resolvedBack  = backImage  ?? certData.BackImageURL  ?? certData.ImageBack  ?? certData.BackImage  ?? null

    console.log('PSA images:', { front: resolvedFront, back: resolvedBack })
    res.json({ cert, grade, pop, frontImage: resolvedFront, backImage: resolvedBack })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
