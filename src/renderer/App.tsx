import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import LoginPage from './pages/LoginPage'
import Layout from './components/layout/Layout'
import ForcePasswordChange from './components/ForcePasswordChange'
import { ToastProvider } from './components/ui/Toast'

// Lazy loading de páginas
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const POSPage = lazy(() => import('./pages/POSPage'))
const InventarioPage = lazy(() => import('./pages/InventarioPage'))
const VentasPage = lazy(() => import('./pages/VentasPage'))
const CajaPage = lazy(() => import('./pages/CajaPage'))
const ComprasPage = lazy(() => import('./pages/ComprasPage'))
const ProveedoresPage = lazy(() => import('./pages/ProveedoresPage'))
const ReportesPage = lazy(() => import('./pages/ReportesPage'))
const ConfigPage = lazy(() => import('./pages/ConfigPage'))
const QuotesPage = lazy(() => import('./pages/QuotesPage'))

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

  return (
    <ToastProvider>
    <BrowserRouter>
      {mustChangePassword && <ForcePasswordChange />}
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  )
}
