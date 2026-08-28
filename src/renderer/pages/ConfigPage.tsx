import { useEffect, useState } from 'react'
import {
  Settings, Store, CreditCard, Users, Plus, Edit2, Trash2,
  Save, Eye, EyeOff, Shield, User, Download, Upload, GraduationCap
} from 'lucide-react'
import { resetTutorial } from '../components/Tutorial'
import { useToast } from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'

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

  const [tab, setTab] = useState<'negocio' | 'usuarios' | 'sistema'>('negocio')
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [cfg, users] = await Promise.all([
      window.api.config.get(),
      window.api.usuarios.list(),
    ])
    setConfig(cfg)
    setUsuarios(users)
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
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        await window.api.config.set(key, value)
      }
      toast.success('Configuración guardada exitosamente')
    } catch (err) {
      toast.error('Error al guardar configuración')
    } finally { setSaving(false) }
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
            <Store className="w-5 h-5 text-blue-600" /> Información del Negocio
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

          {/* Common tax rates reference */}
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">📊 Common Sales Tax Rates (reference)</p>
            <p className="text-xs">No tax: 0% • Oregon, Montana, Delaware: 0% • Texas: 6.25%+ • California: 7.25%+ • New York: 4%+ • Florida: 6%</p>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={saveConfig} disabled={saving}
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
            <button onClick={openCreateUser}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New User
            </button>
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
                        <button onClick={() => openEditUser(u)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => setDeleteUser(u.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
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

      {/* ======== TAB SISTEMA (Backup/Restore) ======== */}
      {tab === 'sistema' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 max-w-2xl">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" /> Backup & Restore
          </h3>
          <p className="text-sm text-gray-500">
            Crea copias de seguridad de tu base de datos o restaura desde un backup anterior.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backup */}
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Crear Backup</h4>
                  <p className="text-xs text-gray-500">Exportar base de datos actual</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Guarda una copia de toda tu información (productos, ventas, caja, etc.) en un archivo .db
              </p>
              <button
                onClick={async () => {
                  setBackupLoading(true)
                  try {
                    const result = await window.api.backup.create()
                    if (result?.success) {
                      toast.success(`Backup creado exitosamente`) 
                    } else if (result?.error !== 'Operación cancelada.') {
                      toast.error(`Error: ${result?.error}`)
                    }
                  } finally {
                    setBackupLoading(false)
                  }
                }}
                disabled={backupLoading}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {backupLoading ? 'Creando backup...' : 'Crear Backup Ahora'}
              </button>
            </div>

            {/* Restore */}
            <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Restaurar Backup</h4>
                  <p className="text-xs text-gray-500">Cargar archivo de respaldo</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Reemplaza la base de datos actual con un backup anterior. Se creará un respaldo automático antes de restaurar.
              </p>
              <button
                onClick={async () => {
                  const confirm = window.confirm('¿Estás seguro? Se reemplazará la base de datos actual con el backup seleccionado.')
                  if (!confirm) return
                  setBackupLoading(true)
                  try {
                    const result = await window.api.backup.restore()
                    if (result?.success) {
                      toast.success('Backup restaurado exitosamente')
                      setTimeout(() => window.location.reload(), 1500)
                    } else if (result?.error !== 'Operación cancelada.') {
                      toast.error(`Error: ${result?.error}`)
                    }
                  } finally {
                    setBackupLoading(false)
                  }
                }}
                disabled={backupLoading}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-orange-300 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> {backupLoading ? 'Restaurando...' : 'Restaurar desde Archivo'}
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
        </div>
      )}
    </div>
  )
}
