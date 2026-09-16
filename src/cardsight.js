import CardSightAI from 'cardsightai'

const apiKey = import.meta.env.VITE_CARDSIGHT_API_KEY

// Recursively proxies every property access so call sites like
// `cardsight.catalog.search(...)` or `cardsight.identify.card(...)` keep
// working without a key configured — the call just rejects instead of the
// whole app crashing at import time.
function disabledClient() {
  const reject = () => Promise.reject(new Error('Cardsight AI is not configured — set VITE_CARDSIGHT_API_KEY'))
  const node = new Proxy(reject, {
    get: (_target, prop) => (prop === 'then' ? undefined : node),
  })
  return node
}

let client
try {
  client = apiKey ? new CardSightAI({ apiKey }) : disabledClient()
} catch (e) {
  console.warn('[cardsight] failed to initialize, AI features disabled:', e)
  client = disabledClient()
}

export const cardsight = client
