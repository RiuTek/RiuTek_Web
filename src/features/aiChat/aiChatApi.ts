import { ApiError, apiClient } from '../../lib/api'

export const AI_MESSAGE_LIMIT = 500
export const AI_HISTORY_LIMIT = 4

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatProduct {
  sku: string
  name: string
  slug: string
  priceVnd: number
  inStock: boolean
  isActive: boolean
  imageUrl?: string | null
}

export interface AiBuildItem {
  productId?: string
  product: AiChatProduct
  component: string
  reason: string
  alreadyOwned: boolean
}

export interface AiChatReply {
  status: 'answered' | 'partial' | 'needs_clarification' | 'insufficient_data' | 'out_of_scope'
  answer: string
  products: AiChatProduct[]
  build?: {
    budgetVnd: number
    totalVnd: number
    recommendedPsuWattage: number
    items: AiBuildItem[]
    useCase?: 'office' | 'gaming' | 'creation' | null
    minRamGb?: number
    minStorageGb?: number
    keptComponents?: string[] | null
  } | null
  sources: {
    kind: 'catalog' | 'manufacturer' | 'faq'
    title: string
    url: string | null
    factKeys: string[]
  }[]
}

export interface AiPreviousBuild {
  budgetVnd: number
  useCase: 'office' | 'gaming' | 'creation'
  minRamGb: number
  minStorageGb: number
  keptComponents: string[]
  items: { productId: string; alreadyOwned: boolean }[]
}

export function previousBuildContext(reply: AiChatReply | undefined): AiPreviousBuild | undefined {
  const build = reply?.build
  if (!build || !build.useCase || build.items.length === 0 || build.items.length > 8 ||
      build.items.some(item => !item.productId)) return undefined
  return {
    budgetVnd: build.budgetVnd,
    useCase: build.useCase,
    minRamGb: build.minRamGb ?? 0,
    minStorageGb: build.minStorageGb ?? 0,
    keptComponents: build.keptComponents ?? [],
    items: build.items.map(item => ({ productId: item.productId!, alreadyOwned: item.alreadyOwned })),
  }
}

export async function askAiChat(
  body: { question: string; productSlug?: string; history: AiChatMessage[]; previousBuild?: AiPreviousBuild },
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>,
  signal: AbortSignal,
) {
  const token = await getAccessToken()
  signal.throwIfAborted()
  if (!token) throw new ApiError({ message: 'Phiên đăng nhập đã hết hạn.', status: 401 })

  try {
    return await apiClient.post<AiChatReply>('/ai/ask', body, { token, signal })
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || signal.aborted) throw error
    const freshToken = await getAccessToken(true)
    signal.throwIfAborted()
    if (!freshToken) throw error
    return apiClient.post<AiChatReply>('/ai/ask', body, { token: freshToken, signal })
  }
}
