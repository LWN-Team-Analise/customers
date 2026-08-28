import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import LiquidGlassDefs from '@/components/LiquidGlass/LiquidGlassDefs'
import CookieConsent from '@/components/CookieConsent/CookieConsent'
import AppRoutes from '@/routes/AppRoutes'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <LiquidGlassDefs />
          <AppRoutes />
          <CookieConsent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
