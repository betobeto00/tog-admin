import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import LoginPage from './pages/LoginPage'
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
import Layout from './components/layout/Layout'
import ForcePasswordChange from './components/ForcePasswordChange'
import { ToastProvider } from './components/ui/Toast'

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
    </BrowserRouter>
    </ToastProvider>
  )
}
