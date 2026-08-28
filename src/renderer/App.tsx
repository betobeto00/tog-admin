import { Suspense, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'

// Imports estáticos — sin lazy loading para compatibilidad con Electron file://
import LoginPage from './pages/LoginPage'
import Layout from './components/layout/Layout'
import ForcePasswordChange from './components/ForcePasswordChange'
import { ToastProvider } from './components/ui/Toast'
import DashboardPage from './pages/DashboardPage'
import POSPage from './pages/POSPage'
import InventarioPage from './pages/InventarioPage'
import VentasPage from './pages/VentasPage'
import CajaPage from './pages/CajaPage'
import ComprasPage from './pages/ComprasPage'
import ProveedoresPage from './pages/ProveedoresPage'
import ReportesPage from './pages/ReportesPage'
import ConfigPage from './pages/ConfigPage'
import QuotesPage from './pages/QuotesPage'
import HelpPage from './pages/HelpPage'
import Tutorial, { hasTutorialCompleted } from './components/Tutorial'

// Loading placeholder para Suspense (usado si hay lazy imports futuros)
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const usuario = useAuthStore((s) => s.usuario)
  const mustChangePassword = isAuthenticated && usuario?.debe_cambiar_contrasena === 1
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !mustChangePassword && !hasTutorialCompleted()) {
      setShowTutorial(true)
    }
  }, [isAuthenticated, mustChangePassword])

  return (
    <ToastProvider>
    <HashRouter>
      {mustChangePassword && <ForcePasswordChange />}
      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="caja" element={<CajaPage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="proveedores" element={<ProveedoresPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="cotizaciones" element={<QuotesPage />} />
          <Route path="configuracion" element={<ConfigPage />} />
          <Route path="ayuda" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </HashRouter>
    </ToastProvider>
  )
}
