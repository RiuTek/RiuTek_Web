import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { HomePage } from '../pages/HomePage'
import { ProductsPage } from '../pages/ProductsPage'
import { ComingSoonPage } from '../pages/ComingSoonPage'
import { NotFoundPage } from '../pages/NotFoundPage'

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
        path: '/pc-builder',
        element: <ComingSoonPage />,
      },
      {
        path: '/cart',
        element: <ComingSoonPage />,
      },
      {
        path: '/login',
        element: <ComingSoonPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
