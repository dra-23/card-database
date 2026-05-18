import CardSightAI from 'cardsightai'

export const cardsight = new CardSightAI({
  apiKey: import.meta.env.VITE_CARDSIGHT_API_KEY,
})
