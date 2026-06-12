import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createBrowserRouter, RouterProvider, Route, createRoutesFromElements } from 'react-router-dom'
import { applyTheme, loadTheme } from './lib/theme'
import { Toaster } from 'sonner'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

const router = createBrowserRouter(
  createRoutesFromElements(<Route path="*" element={<App />} />),
)

applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/household/setup"
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
)
