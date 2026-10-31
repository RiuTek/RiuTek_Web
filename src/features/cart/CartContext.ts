import { createContext, useContext } from 'react'
import type { CartDto, CartStatus } from './cartTypes'
import type { CartSelectionTotals } from './cartSelectionHelper'

export interface CartContextValue {
  cart: CartDto | null
  status: CartStatus
  error: string | null
  isMutating: boolean
  itemCount: number
  loadCart: () => Promise<void>
  addItem: (productId: string, quantity: number) => Promise<CartDto>
  addFromPCBuild: (pcBuildId: string) => Promise<CartDto>
  setQuantity: (productId: string, quantity: number) => Promise<CartDto>
  removeItem: (productId: string) => Promise<void>
  clearCart: () => Promise<void>
  clearError: () => void

  // Selection states & operations
  selectedProductIds: string[]
  setSelectedProductIds: (ids: string[] | ((prev: string[]) => string[])) => void
  toggleSelectProduct: (productId: string) => void
  toggleSelectAll: () => void
  isProductSelected: (productId: string) => boolean
  selectedTotals: CartSelectionTotals
  prunedNotification: string | null
  clearPrunedNotification: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart phải được sử dụng bên trong CartProvider')
  }
  return context
}
