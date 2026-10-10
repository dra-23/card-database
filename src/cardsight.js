import { auth } from './firebase.js'

// Every call goes through our own /api/cardsight function (functions/index.js),
// which holds the API key server-side — anything read from a VITE_ env var is
// baked into the public JS bundle. Mirrors the subset of the cardsightai SDK
// the app uses, with the same { data, error } return shape.
async function call(path, { method = 'GET', query, body } = {}) {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return { data: null, error: new Error('Not signed in') }
    const qs = query ? `?${new URLSearchParams(query)}` : ''
    const res = await fetch(`/api/cardsight${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { data: null, error: data || new Error(`Cardsight request failed (${res.status})`) }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e }
  }
}

export const cardsight = {
  catalog: {
    search: params => call('/v1/catalog/search', { query: params }),
    cards: { get: id => call(`/v1/catalog/cards/${encodeURIComponent(id)}`) },
  },
  pricing: {
    get: (cardId, params) => call(`/v1/pricing/${encodeURIComponent(cardId)}`, { query: params }),
    // Free-text search over sold-listing titles
    search: params => call('/v1/pricing/search', { query: params }),
  },
  images: {
    getCard: (id, params) => call(`/v1/images/cards/${encodeURIComponent(id)}`, { query: params }),
  },
  identify: {
    card: file => {
      const form = new FormData()
      form.append('image', file)
      return call('/v1/identify/card', { method: 'POST', body: form })
    },
  },
}
