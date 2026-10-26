import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '../features/auth/AuthProvider'
import { CartProvider } from '../features/cart/CartProvider'
import { AddressProvider } from '../features/addresses/AddressProvider'

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <AddressProvider>
          <RouterProvider router={router} />
        </AddressProvider>
      </CartProvider>
    </AuthProvider>
  )
}
