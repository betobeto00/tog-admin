import { useEffect, useState } from 'react'
import {
  Settings, Store, CreditCard, Users, Plus, Edit2, Trash2,
  Save, Eye, EyeOff, Shield, User, Download, Upload, GraduationCap, Key, Clock,
  Wifi, WifiOff, Plug, Unplug, Lock
} from 'lucide-react'
import { resetTutorial } from '../components/Tutorial'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import PermissionsModal from '../components/ui/PermissionsModal'
import { usePermissions } from '../hooks/usePermissions'

interface Config { clave: string; valor: string; descripcion: string | null }
interface Usuario { id: number; usuario: string; nombre: string; rol: string; activo: number }

export default function ConfigPage() {
  const toast = useToast()
  const [config, setConfig] = useState<Config[]>([])
  const [saving, setSaving] = useState(false)

  // Form datos negocio
  const [form, setForm] = useState({
    nombre_negocio: '', ein: '', telefono: '', direccion: '',
    sales_tax_rate: '', currency_symbol: '$',
  })

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [userForm, setUserForm] = useState({ usuario: '', nombre: '', contrasena: '', rol: 'cajero' })
  const [deleteUser, setDeleteUser] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // {t('config.permissions')} de usuario
  const [permissionsUser, setPermissionsUser] = useState<Usuario | null>(null)

  // {t('config.permissions')} del usuario actual
  const { has } = usePermissions()

  const [tab, setTab] = useState<'negocio' | 'usuarios' | 'terminal' | 'sistema'>('negocio')
  const [backupLoading, setBackupLoading] = useState(false)

  // Licencia
  const [licenseStatus, setLicenseStatus] = useState<any>(null)
  const [licenseLoading, setLicenseLoading] = useState(true)

  // Terminal VP800
  const [terminalPort, setTerminalPort] = useState('COM3')
  const [terminalBaud, setTerminalBaud] = useState('9600')
  const [terminalConnected, setTerminalConnected] = useState(false)
  const [terminalConnecting, setTerminalConnecting] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState<any>(null)

  // Config sistema
  const [printerName, setPrinterName] = useState('')
  const [fondoDefault, setFondoDefault] = useState('')

  useEffect(() => { loadData() }, [])

  const loadUsuarios = async () => {
    const users = await window.api.usuarios.list()
    setUsuarios(users)
  }

  const loadData = async () => {
    const [cfg, users] = await Promise.all([
      window.api.config.get(),
      window.api.usuarios.list(),
    ])
    setConfig(cfg)
    setUsuarios(users)
    // Cargar licencia
    try {
      const ls = await window.api.license.status()
      setLicenseStatus(ls)
    } catch {}
    setLicenseLoading(false)
    // Cargar estado del terminal
    try {
      const ts = await window.api.terminal.estado()
      setTerminalStatus(ts)
      setTerminalConnected(ts.conectado)
      if (ts.puerto) setTerminalPort(ts.puerto)
    } catch {}
    // Llenar form con config actual
    const get = (key: string) => cfg.find((c: Config) => c.clave === key)?.valor || ''
    setForm({
      nombre_negocio: get('nombre_negocio'),
      ein: get('ein'),
      telefono: get('telefono'),
      direccion: get('direccion'),
      sales_tax_rate: get('sales_tax_rate'),
      currency_symbol: get('currency_symbol') || '$',
    })
    setPrinterName(get('printer_name'))
    setFondoDefault(get('fondo_inicial_default'))
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        await window.api.config.set(key, value)
      }
      await window.api.config.set('printer_name', printerName)
      await window.api.config.set('fondo_inicial_default', fondoDefault)
      toast.success('Configuración guardada exitosamente')
    } catch (err) {
      toast.error('Error al guardar configuración')
    } finally { setSaving(false) }
  }

  // ======== TERMINAL VP800 ========
  const connectTerminal = async () => {
    if (!terminalPort.trim()) {
      toast.error('Ingresa el puerto COM (ej: COM3)')
      return
    }
    setTerminalConnecting(true)
    try {
      const result = await window.api.terminal.conectar(terminalPort.trim(), parseInt(terminalBaud))
      if (result.success) {
        setTerminalConnected(true)
        toast.success(`Terminal conectado en ${terminalPort}`)
        const ts = await window.api.terminal.estado()
        setTerminalStatus(ts)
      } else {
        toast.error(result.error || 'Error conectando al terminal')
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'No se pudo conectar'))
    } finally {
      setTerminalConnecting(false)
    }
  }

  const disconnectTerminal = async () => {
    try {
      await window.api.terminal.desconectar()
      setTerminalConnected(false)
      setTerminalStatus(null)
      toast.success('Terminal desconectado')
    } catch (err: any) {
      toast.error('Error desconectando: ' + err.message)
    }
  }

  // ======== USUARIOS ========
  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({ usuario: '', nombre: '', contrasena: '', rol: 'cajero' })
    setUserModalOpen(true)
  }

  const openEditUser = (u: Usuario) => {
    setEditingUser(u)
    setUserForm({ usuario: u.usuario, nombre: u.nombre, contrasena: '', rol: u.rol })
    setUserModalOpen(true)
  }

  const saveUser = async () => {
    if (!userForm.usuario.trim() || !userForm.nombre.trim()) return
    if (editingUser) {
      const data: any = { nombre: userForm.nombre, rol: userForm.rol }
      // Solo actualizar contraseña si se escribió una nueva
      if (userForm.contrasena.trim()) {
        data.contrasena = userForm.contrasena
      }
      await window.api.usuarios.update(editingUser.id, data)
    } else {
      if (!userForm.contrasena) return
      await window.api.usuarios.create(userForm)
    }
    setUserModalOpen(false)
    await loadData()
  }

  const deleteUser_ = async (id: number) => {
    await window.api.usuarios.delete(id)
    await loadData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Ajustes del negocio y gestión de usuarios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('negocio')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'negocio' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <Store className="w-4 h-4 inline mr-1.5" /> Datos del Negocio
        </button>
        <button onClick={() => setTab('usuarios')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'usuarios' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <Users className="w-4 h-4 inline mr-1.5" /> Usuarios
        </button>
        <button onClick={() => setTab('terminal')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'terminal' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <CreditCard className="w-4 h-4 inline mr-1.5" /> Terminal
        </button>
        <button onClick={() => setTab('sistema')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'sistema' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <Settings className="w-4 h-4 inline mr-1.5" /> Sistema
        </button>
      </div>

      {tab === 'negocio' ? (
        /* ======== DATOS DEL NEGOCIO ======== */
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" /> {t('config.businessInfo')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input value={form.nombre_negocio} onChange={(e) => setForm({ ...form, nombre_negocio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="My Business Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EIN (Tax ID)</label>
              <input value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="XX-XXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">Employer Identification Number (optional)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="123 Main St, City, State ZIP" />
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 pt-4 border-t border-gray-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" /> Tax & Currency
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales Tax Rate (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={form.sales_tax_rate}
                onChange={(e) => setForm({ ...form, sales_tax_rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
              <p className="text-xs text-gray-400 mt-1">Varies by state/county. Set to 0 if tax-exempt.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
              <input value={form.currency_symbol}
                onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="$" />
              <p className="text-xs text-gray-400 mt-1">Default: $ (USD)</p>
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 pt-4 border-t border-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" /> Operación
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impresora (nombre)</label>
              <input value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Thermal Printer, default printer" />
              <p className="text-xs text-gray-400 mt-1">{t('config.printerHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fondo Inicial Default</label>
              <input type="number" step="0.01" min="0" value={fondoDefault}
                onChange={(e) => setFondoDefault(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="100.00" />
              <p className="text-xs text-gray-400 mt-1">Monto sugerido al abrir caja (puede cambiarse)</p>
            </div>
          </div>

          {/* Common tax rates reference */}
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">📊 Common Sales Tax Rates (reference)</p>
            <p className="text-xs">No tax: 0% • Oregon, Montana, Delaware: 0% • Texas: 6.25%+ • California: 7.25%+ • New York: 4%+ • Florida: 6%</p>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={saveConfig} disabled={saving || !form.nombre_negocio.trim()}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      ) : (
        /* ======== GESTIÓN DE USUARIOS ======== */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{usuarios.length} users registered</p>
            {has('usuarios_access') && (
              <button onClick={openCreateUser}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> New User
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{u.usuario}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Shield className="w-3 h-3" /> {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.activo ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {has('usuarios_manage_roles') && (
                          <button onClick={() => setPermissionsUser(u)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={t('config.permissions')}>
                            <Lock className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        {has('usuarios_access') && (
                          <button onClick={() => openEditUser(u)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                        {has('usuarios_access') && (
                          <button onClick={() => setDeleteUser(u.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal User */}
      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)}
        title={editingUser ? 'Edit User' : 'New User'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input value={userForm.usuario} onChange={(e) => setUserForm({ ...userForm, usuario: e.target.value })}
              disabled={!!editingUser}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="e.g. john" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input value={userForm.nombre} onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. John Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {editingUser ? '(leave blank to keep current)' : '*'}
            </label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={userForm.contrasena}
                onChange={(e) => setUserForm({ ...userForm, contrasena: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder={editingUser ? 'Enter new password or leave blank' : 'Min 6 characters'} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select value={userForm.rol} onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="cajero">Cashier</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {userForm.rol === 'admin' ? 'Full access to all modules including configuration' : 'Access to POS, inventory, and daily operations'}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setUserModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={saveUser}
              disabled={!userForm.usuario.trim() || !userForm.nombre.trim() || (!editingUser && !userForm.contrasena)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteUser} onClose={() => setDeleteUser(null)}
        onConfirm={() => { if (deleteUser) deleteUser_(deleteUser) }}
        title="Delete user" message="This user will be deactivated. They won't be able to log in anymore."
        confirmText="Deactivate" danger />

      {/* ======== MODAL PERMISOS ======== */}
      {permissionsUser && (
        <PermissionsModal
          open={!!permissionsUser}
          onClose={() => setPermissionsUser(null)}
          userId={permissionsUser.id}
          userName={permissionsUser.nombre}
          userRole={permissionsUser.rol}
          onSave={loadUsuarios}
        />
      )}

      {/* ======== TAB TERMINAL VP800 ======== */}
      {tab === 'terminal' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" /> Terminal VP800 — Pago con Tarjeta
          </h3>
          <p className="text-sm text-gray-500">
            Configura la conexión con el terminal de pago Valor VP800 para procesar tarjetas de crédito/débito.
          </p>

          {/* Estado de conexión */}
          <div className={`rounded-xl p-4 flex items-center gap-3 ${
            terminalConnected
              ? 'bg-green-50 border border-green-200'
              : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className={`p-2 rounded-lg ${
              terminalConnected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {terminalConnected
                ? <Wifi className="w-5 h-5 text-green-600" />
                : <WifiOff className="w-5 h-5 text-gray-400" />
              }
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${
                terminalConnected ? 'text-green-800' : 'text-gray-600'
              }`}>
                {terminalConnected ? 'Conectado' : 'Desconectado'}
              </p>
              {terminalConnected && terminalStatus?.puerto && (
                <p className="text-xs text-green-600">Puerto: {terminalStatus.puerto}</p>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full ${
              terminalConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`} />
          </div>

          {/* Configuración */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Puerto COM *
              </label>
              <input
                type="text"
                value={terminalPort}
                onChange={(e) => setTerminalPort(e.target.value.toUpperCase())}
                disabled={terminalConnected}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="COM3"
              />
              <p className="text-xs text-gray-400 mt-1">
                Verifica en Administrador de Dispositivos → Puertos (COM)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Baud Rate
              </label>
              <select
                value={terminalBaud}
                onChange={(e) => setTerminalBaud(e.target.value)}
                disabled={terminalConnected}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="9600">9600 (estándar)</option>
                <option value="19200">19200</option>
                <option value="38400">38400</option>
                <option value="57600">57600</option>
                <option value="115200">115200</option>
              </select>
            </div>
          </div>

          {/* Botones de conexión */}
          <div className="flex gap-3">
            {!terminalConnected ? (
              <button
                onClick={connectTerminal}
                disabled={terminalConnecting || !terminalPort.trim()}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center justify-center gap-2"
              >
                {terminalConnecting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Conectando...
                  </>
                ) : (
                  <><Plug className="w-4 h-4" /> Conectar Terminal</>
                )}
              </button>
            ) : (
              <button
                onClick={disconnectTerminal}
                className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
              >
                <Unplug className="w-4 h-4" /> Desconectar Terminal
              </button>
            )}
          </div>

          {/* Información */}
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-2">📋 Instrucciones de conexión:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-600">
              <li>Conecta el VP800 por cable USB a la computadora</li>
              <li>Abre <strong>Administrador de Dispositivos</strong> → <strong>Puertos (COM y LPT)</strong></li>
              <li>Busca el puerto asignado al VP800 (ej: COM3, COM4, etc.)</li>
              <li>Ingresa el puerto en el campo de arriba</li>
              <li>Haz clic en <strong>Conectar Terminal</strong></li>
              <li>El terminal está listo para procesar pagos con tarjeta</li>
            </ol>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-700">
            <p className="font-medium mb-1">💡 Tips</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-yellow-600">
              <li>El puerto COM varía según la PC — siempre verificar en Administrador de Dispositivos</li>
              <li>Si el terminal no responde, desconecta y vuelve a conectar el cable USB</li>
              <li>El VP800 necesita batería cargada o estar conectado a la corriente</li>
              <li>Baud Rate estándar: 9600 (no cambiar除非el fabricante lo indique)</li>
              <li>Al procesar un pago, el terminal muestra "Inserte/Tarjee la tarjeta" automáticamente</li>
            </ul>
          </div>
        </div>
      )}

      {/* ======== TAB SISTEMA (Backup/Restore) ======== */}
      {tab === 'sistema' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" /> Backup & Restore
          </h3>
          <p className="text-sm text-gray-500">
            {t('config.backupDesc')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backup */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{t('config.createBackupTitle')}</h4>
                  <p className="text-xs text-gray-500">{t('config.exportDatabase')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('config.backupDesc')}
              </p>
              <button
                onClick={async () => {
                  setBackupLoading(true)
                  try {
                    const result = await window.api.backup.create()
                    if (result?.success) {
                      toast.success(`{t('caja.backupCreated')}`) 
                    } else if (result?.error !== t('common.operationCancelled')) {
                      toast.error(`Error: ${result?.error}`)
                    }
                  } finally {
                    setBackupLoading(false)
                  }
                }}
                disabled={backupLoading || !has('config_backup')}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!has('config_backup') ? t('config.noPermBackup') : ''}
              >
                <Download className="w-4 h-4" /> {backupLoading ? t('caja.creatingBackup') : t('config.createBackupTitle')}
                {!has('config_backup') && <span className="text-xs opacity-70">{t('config.noPermission')}</span>}
              </button>
            </div>

            {/* Restore */}
            <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{t('config.restoreBackupTitle')}</h4>
                  <p className="text-xs text-gray-500">{t('config.loadBackupFile')}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('config.restoreDesc')}
              </p>
              <button
                onClick={async () => {
                  const confirm = window.confirm(t('caja.restoreConfirm'))
                  if (!confirm) return
                  setBackupLoading(true)
                  try {
                    const result = await window.api.backup.restore()
                    if (result?.success) {
                      toast.success(t('caja.backupRestored'))
                      setTimeout(() => window.location.reload(), 1500)
                    } else if (result?.error !== t('common.operationCancelled')) {
                      toast.error(`Error: ${result?.error}`)
                    }
                  } finally {
                    setBackupLoading(false)
                  }
                }}
                disabled={backupLoading || !has('config_backup')}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!has('config_backup') ? t('config.noPermRestore') : ''}
              >
                <Upload className="w-4 h-4" /> {backupLoading ? t('caja.restoring') : t('caja.restoreFromFile')}
                {!has('config_backup') && <span className="text-xs opacity-70">{t('config.noPermission')}</span>}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-700">
            <p className="font-medium mb-1">⚠️ Importante</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>El backup contiene TODA la información del sistema</li>
              <li>Se recomienda hacer backup diariamente antes de cerrar caja</li>
              <li>La restauración creará un backup automático (.bak) por seguridad</li>
            </ul>
          </div>

          {/* Tutorial */}
          <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Tutorial de Onboarding</h4>
                <p className="text-xs text-gray-500">Guía interactiva para nuevos usuarios</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Reinicia el tutorial para que el próximo usuario que entre vea la guía de inicio.
            </p>
            <button
              onClick={() => {
                resetTutorial()
                toast.success('Tutorial reiniciado. Se mostrará en el próximo login.')
              }}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <GraduationCap className="w-4 h-4" /> Reiniciar Tutorial
            </button>
          </div>

          {/* Licencia */}
          <div className="bg-green-50 rounded-xl p-5 border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Key className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Licencia del Software</h4>
                <p className="text-xs text-gray-500">Estado y gestión de la licencia</p>
              </div>
            </div>

            {licenseLoading ? (
              <p className="text-sm text-gray-500">Cargando...</p>
            ) : licenseStatus ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Estado:</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                      licenseStatus.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {licenseStatus.valid ? '✅ Válida' : '❌ No válida'}
                    </span>
                  </div>
                  {licenseStatus.cliente && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Cliente:</span>
                      <span className="font-medium">{licenseStatus.cliente}</span>
                    </div>
                  )}
                  {licenseStatus.expira && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Expira:</span>
                      <span className="font-medium">{licenseStatus.expira}</span>
                    </div>
                  )}
                  {licenseStatus.diasRestantes !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Días restantes:</span>
                      <span className={`font-semibold ${
                        licenseStatus.diasRestantes <= 30 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {licenseStatus.diasRestantes} días
                      </span>
                    </div>
                  )}
                </div>
                {licenseStatus.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    {licenseStatus.error}
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                  <p><strong>ID de máquina:</strong> <span className="font-mono">{licenseStatus.machineId}</span></p>
                  <p className="mt-1">Envía este ID al administrador para generar o renovar tu licencia.</p>
                </div>
                <button
                  onClick={async () => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.key,.json'
                    input.onchange = async (e: any) => {
                      const file = e.target.files[0]
                      if (!file) return
                      const content = await file.text()
                      const result = await window.api.license.import(content)
                      if (result.success) {
                        toast.success('Licencia importada exitosamente')
                        const ls = await window.api.license.status()
                        setLicenseStatus(ls)
                      } else {
                        toast.error(result.error || 'Error importando licencia')
                      }
                    }
                    input.click()
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Importar Nueva Licencia
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('config.noLicenseStatus')}</p>
            )}
          </div>

          {/* {t('config.dangerZone')} */}
          <div className="bg-red-50 rounded-xl p-5 border border-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-900">{t('config.dangerZone')}</h4>
                <p className="text-xs text-red-500">{t('config.irreversibleActions')}</p>
              </div>
            </div>
            <p className="text-sm text-red-700 mb-4">
              <strong>{t('config.resetDbButton')}:</strong> {t('config.resetDbFullDesc')}
              
            </p>
            <button
              onClick={async () => {
                // Triple confirmación
                const step1 = window.confirm(t('config.resetDbWarning'))
                if (!step1) return

                const step2 = window.confirm(t('config.resetDbLastChance'))\n\n¿Confirmas?'
                )
                if (!step2) return

                const confirmText = window.prompt(
                  t('config.resetDbConfirm')
                )
                if (confirmText !== 'RESET') {
                  toast.error(t('config.resetDbIncorrect'))
                  return
                }

                try {
                  const result = await window.api.db.reset()
                  if (result?.success) {
                    toast.success(t('config.resetDbSuccessMsg'))
                    setTimeout(() => window.location.reload(), 2000)
                  } else {
                    toast.error(result?.error || t('config.resetDbErrorMsg'))
                  }
                } catch (err: any) {
                  toast.error('Error: ' + err.message)
                }
              }}
              disabled={!has('config_db_reset')}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2"                title={!has('config_db_reset') ? t('config.noPermReset') : ''}
            >
              <Trash2 className="w-4 h-4" /> {t('config.resetDbButton')}
              {!has('config_db_reset') && <span className="text-xs opacity-70">{t('config.noPermission')}</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
