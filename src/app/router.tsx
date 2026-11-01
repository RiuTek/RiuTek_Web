import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { HomePage } from '../pages/HomePage'
import { ProductsPage } from '../pages/ProductsPage'
import { ProductDetailPage } from '../pages/ProductDetailPage'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { AccountPage } from '../pages/AccountPage'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { CheckoutCompletePage } from '../pages/CheckoutCompletePage'
import { StripeCheckoutCancelPage } from '../pages/StripeCheckoutCancelPage'
import { MyOrdersPage } from '../pages/MyOrdersPage'
import { OrderDetailPage } from '../pages/OrderDetailPage'
import { MyPCBuildsPage } from '../pages/MyPCBuildsPage'
import { PCBuildDetailPage } from '../pages/PCBuildDetailPage'
import { EditPCBuildPage } from '../pages/EditPCBuildPage'
import { ProductBuyNowPage } from '../pages/ProductBuyNowPage'
import { PCBuildBuyNowPage } from '../pages/PCBuildBuyNowPage'
import { PCBuilderPage } from '../pages/PCBuilderPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireAdminOrStaff } from '../features/admin/RequireAdminOrStaff'

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/products',
        element: <ProductsPage />,
      },
      {
        path: '/products/:slug',
        element: <ProductDetailPage />,
      },
      {
        path: '/pc-builder',
        element: <PCBuilderPage />,
      },
      {
        path: '/cart',
        element: (
          <RequireAuth>
            <CartPage />
          </RequireAuth>
        ),
      },
      {
        path: '/checkout',
        element: (
          <RequireAuth>
            <CheckoutPage />
          </RequireAuth>
        ),
      },
      {
        path: '/checkout/success',
        element: (
          <RequireAuth>
            <CheckoutCompletePage />
          </RequireAuth>
        ),
      },
      {
        path: '/checkout/cancel',
        element: (
          <RequireAuth>
            <StripeCheckoutCancelPage />
          </RequireAuth>
        ),
      },
      {
        path: '/buy-now/product/:slug',
        element: (
          <RequireAuth>
            <ProductBuyNowPage />
          </RequireAuth>
        ),
      },
      {
        path: '/buy-now/pc-build/:buildId',
        element: (
          <RequireAuth>
            <PCBuildBuyNowPage />
          </RequireAuth>
        ),
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/account',
        element: (
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        ),
      },
      {
        path: '/orders',
        element: (
          <RequireAuth>
            <MyOrdersPage />
          </RequireAuth>
        ),
      },
      {
        path: '/orders/:orderId',
        element: (
          <RequireAuth>
            <OrderDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: '/pc-builds',
        element: (
          <RequireAuth>
            <MyPCBuildsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/pc-builds/:buildId',
        element: (
          <RequireAuth>
            <PCBuildDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: '/pc-builds/:buildId/edit',
        element: (
          <RequireAuth>
            <EditPCBuildPage />
          </RequireAuth>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAdminOrStaff>
        <AdminLayout />
      </RequireAdminOrStaff>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/products" replace />,
      },
      {
        path: 'categories',
        lazy: async () => {
          const { AdminCategoriesPage } = await import(
            '../pages/admin/AdminCategoriesPage'
          )
          return { Component: AdminCategoriesPage }
        },
      },
      {
        path: 'products',
        lazy: async () => {
          const { AdminProductsPage } = await import(
            '../pages/admin/AdminProductsPage'
          )
          return { Component: AdminProductsPage }
        },
      },
      {
        path: 'products/new',
        lazy: async () => {
          const { AdminProductCreatePage } = await import(
            '../pages/admin/AdminProductCreatePage'
          )
          return { Component: AdminProductCreatePage }
        },
      },
      {
        path: 'product-imports',
        lazy: async () => {
          const { AdminProductImportsPage } = await import(
            '../pages/admin/AdminProductImportsPage'
          )
          return { Component: AdminProductImportsPage }
        },
      },
      {
        path: 'products/:id/edit',
        lazy: async () => {
          const { AdminProductEditPage } = await import(
            '../pages/admin/AdminProductEditPage'
          )
          return { Component: AdminProductEditPage }
        },
      },
      {
        path: '*',
        element: <Navigate to="/admin/products" replace />,
      },
    ],
  },
])
