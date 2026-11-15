import { apiClient } from '../../lib/api'

export const AI_MESSAGE_LIMIT = 500
export const AI_HISTORY_LIMIT = 4

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatReply {
  status: 'answered' | 'partial' | 'needs_clarification' | 'insufficient_data' | 'out_of_scope'
  answer: string
  products: {
    sku: string
    name: string
    slug: string
    priceVnd: number
    inStock: boolean
    isActive: boolean
    imageUrl?: string | null
  }[]
  sources: {
    kind: 'catalog' | 'manufacturer' | 'faq'
    title: string
    url: string | null
    factKeys: string[]
  }[]
}

export function askAiChat(
  body: { question: string; productSlug?: string; history: AiChatMessage[] },
  token: string,
  signal: AbortSignal,
) {
  return apiClient.post<AiChatReply>('/ai/ask', body, { token, signal })
}
