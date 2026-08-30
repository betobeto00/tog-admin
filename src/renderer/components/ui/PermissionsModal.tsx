import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Shield, Check } from 'lucide-react'
import Modal from './Modal'

// Permission definitions (duplicated from shared/permissions.ts for renderer)
const PERMISSIONS: Record<string, {
  label: { es: string; en: string }
  category: { es: string; en: string }
  description: { es: string; en: string }
}> = {
  pos_access: { label: { es: 'Usar Punto de Venta', en: 'Use Point of Sale' }, category: { es: 'Ventas', en: 'Sales' }, description: { es: 'Acceder al módulo de POS y procesar ventas', en: 'Access POS module and process sales' } },
  pos_void_sale: { label: { es: 'Anular Ventas', en: 'Void Sales' }, category: { es: 'Ventas', en: 'Sales' }, description: { es: 'Anular/devolver ventas registradas', en: 'Void/return registered sales' } },
  pos_discount: { label: { es: 'Aplicar Descuentos', en: 'Apply Discounts' }, category: { es: 'Ventas', en: 'Sales' }, description: { es: 'Aplicar descuentos por item o globales', en: 'Apply item or global discounts' } },
  pos_edit_price: { label: { es: 'Editar Precio en Venta', en: 'Edit Sale Price' }, category: { es: 'Ventas', en: 'Sales' }, description: { es: 'Cambiar el precio unitario al vender', en: 'Change unit price when selling' } },
  pos_quick_sale: { label: { es: 'Venta Rápida (Servicio)', en: 'Quick Sale (Service)' }, category: { es: 'Ventas', en: 'Sales' }, description: { es: 'Agregar servicios/manuales al carrito', en: 'Add services/manual items to cart' } },
  caja_access: { label: { es: 'Usar Módulo de Caja', en: 'Use Cash Register' }, category: { es: 'Caja', en: 'Cash Register' }, description: { es: 'Acceder al módulo de caja', en: 'Access cash register module' } },
  caja_open: { label: { es: 'Abrir Caja', en: 'Open Register' }, category: { es: 'Caja', en: 'Cash Register' }, description: { es: 'Abrir caja con fondo inicial', en: 'Open register with initial float' } },
  caja_close: { label: { es: 'Cerrar Caja', en: 'Close Register' }, category: { es: 'Caja', en: 'Cash Register' }, description: { es: 'Cerrar caja y hacer conciliación', en: 'Close register and reconcile' } },
  caja_movement: { label: { es: 'Movimientos de Caja', en: 'Register Movements' }, category: { es: 'Caja', en: 'Cash Register' }, description: { es: 'Registrar entradas, retiros y notas', en: 'Record entries, withdrawals and notes' } },
  caja_report_x: { label: { es: 'Reporte X (Parcial)', en: 'X Report (Partial)' }, category: { es: 'Caja', en: 'Cash Register' }, description: { es: 'Ver reporte parcial sin cerrar caja', en: 'View partial report without closing' } },
  inventario_access: { label: { es: 'Usar Módulo de Inventario', en: 'Use Inventory Module' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Acceder al módulo de inventario', en: 'Access inventory module' } },
  inventario_create: { label: { es: 'Crear Productos', en: 'Create Products' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Agregar nuevos productos al inventario', en: 'Add new products to inventory' } },
  inventario_edit: { label: { es: 'Editar Productos', en: 'Edit Products' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Modificar información de productos', en: 'Modify product information' } },
  inventario_delete: { label: { es: 'Eliminar Productos', en: 'Delete Products' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Eliminar productos del inventario', en: 'Delete products from inventory' } },
  inventario_adjust: { label: { es: 'Ajustar Stock', en: 'Adjust Stock' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Ajustar stock manualmente', en: 'Manually adjust stock' } },
  inventario_categories: { label: { es: 'Gestionar Categorías', en: 'Manage Categories' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Crear, editar y eliminar categorías', en: 'Create, edit and delete categories' } },
  inventario_units: { label: { es: 'Gestionar Unidades', en: 'Manage Units' }, category: { es: 'Inventario', en: 'Inventory' }, description: { es: 'Crear, editar y eliminar unidades de medida', en: 'Create, edit and delete units of measure' } },
  compras_access: { label: { es: 'Usar Módulo de Compras', en: 'Use Purchases Module' }, category: { es: 'Compras', en: 'Purchases' }, description: { es: 'Acceder al módulo de compras', en: 'Access purchases module' } },
  compras_create: { label: { es: 'Registrar Compras', en: 'Register Purchases' }, category: { es: 'Compras', en: 'Purchases' }, description: { es: 'Crear nuevas compras y actualizar stock', en: 'Create new purchases and update stock' } },
  compras_suppliers: { label: { es: 'Gestionar Proveedores', en: 'Manage Suppliers' }, category: { es: 'Compras', en: 'Purchases' }, description: { es: 'Crear, editar y eliminar proveedores', en: 'Create, edit and delete suppliers' } },
  quotes_access: { label: { es: 'Usar Cotizaciones', en: 'Use Quotes' }, category: { es: 'Cotizaciones', en: 'Quotes' }, description: { es: 'Acceder al módulo de cotizaciones', en: 'Access quotes module' } },
  quotes_create: { label: { es: 'Crear Cotizaciones', en: 'Create Quotes' }, category: { es: 'Cotizaciones', en: 'Quotes' }, description: { es: 'Crear nuevas cotizaciones para clientes', en: 'Create new quotes for customers' } },
  reportes_access: { label: { es: 'Ver Reportes', en: 'View Reports' }, category: { es: 'Reportes', en: 'Reports' }, description: { es: 'Acceder al módulo de reportes', en: 'Access reports module' } },
  reportes_export: { label: { es: 'Exportar Reportes', en: 'Export Reports' }, category: { es: 'Reportes', en: 'Reports' }, description: { es: 'Exportar reportes a CSV o PDF', en: 'Export reports to CSV or PDF' } },
  config_access: { label: { es: 'Ver Configuración', en: 'View Settings' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Acceder a la configuración del sistema', en: 'Access system settings' } },
  config_edit: { label: { es: 'Editar Configuración', en: 'Edit Settings' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Modificar datos del negocio, impuestos', en: 'Modify business data, taxes' } },
  config_terminal: { label: { es: 'Configurar Terminal VP800', en: 'Configure VP800 Terminal' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Configurar conexión del terminal', en: 'Configure terminal connection' } },
  config_backup: { label: { es: 'Gestionar Backups', en: 'Manage Backups' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Crear y restaurar copias de seguridad', en: 'Create and restore backups' } },
  config_db_reset: { label: { es: 'Resetear Base de Datos', en: 'Reset Database' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Borrar y reiniciar la DB (PELIGROSO)', en: 'Delete and reset database (DANGEROUS)' } },
  usuarios_access: { label: { es: 'Gestionar Usuarios', en: 'Manage Users' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Crear, editar, eliminar usuarios', en: 'Create, edit, delete users' } },
  usuarios_manage_roles: { label: { es: 'Asignar Permisos', en: 'Assign Permissions' }, category: { es: 'Administración', en: 'Administration' }, description: { es: 'Modificar permisos de otros usuarios', en: 'Modify other users permissions' } },
}

const CATEGORIES = [
  { key: 'Ventas', icon: '🛒', color: 'blue' as const },
  { key: 'Caja', icon: '💰', color: 'green' as const },
  { key: 'Inventario', icon: '📦', color: 'purple' as const },
  { key: 'Compras', icon: '🚚', color: 'orange' as const },
  { key: 'Cotizaciones', icon: '📝', color: 'cyan' as const },
  { key: 'Reportes', icon: '📊', color: 'indigo' as const },
  { key: 'Administración', icon: '⚙️', color: 'red' as const },
]

// Color mappings for Tailwind classes
const colorMap: Record<string, { bg: string; border: string; text: string; toggle: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', toggle: 'bg-blue-600' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', toggle: 'bg-green-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', toggle: 'bg-purple-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', toggle: 'bg-orange-600' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', toggle: 'bg-cyan-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', toggle: 'bg-indigo-600' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', toggle: 'bg-red-600' },
}

interface PermissionsModalProps {
  open: boolean
  onClose: () => void
  userId: number
  userName: string
  userRole: string
  onSave: () => void
}

export default function PermissionsModal({ open, onClose, userId, userName, userRole, onSave }: PermissionsModalProps) {
  const { i18n } = useTranslation()
  const [permisos, setPermisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const lang = i18n.language === 'en' ? 'en' : 'es'

  useEffect(() => {
    if (open) loadPermissions()
  }, [open, userId])

  const loadPermissions = async () => {
    setLoading(true)
    const result = await window.api.usuarios.getPermissions(userId)
    if (result.success && result.permisos) {
      setPermisos(result.permisos)
    }
    setLoading(false)
  }

  const togglePermission = (perm: string) => {
    setPermisos((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const toggleCategory = (catKey: string) => {
    const catPerms = Object.entries(PERMISSIONS)
      .filter(([_, def]) => def.category[lang] === catKey)
      .map(([key]) => key)

    const allActive = catPerms.every((p) => permisos.includes(p))
    if (allActive) {
      setPermisos((prev) => prev.filter((p) => !catPerms.includes(p)))
    } else {
      setPermisos((prev) => [...new Set([...prev, ...catPerms])])
    }
  }

  const selectAll = () => setPermisos(Object.keys(PERMISSIONS))
  const deselectAll = () => setPermisos([])

  const save = async () => {
    setSaving(true)
    await window.api.usuarios.setPermissions(userId, permisos)
    setSaving(false)
    onSave()
    onClose()
  }

  if (userRole === 'admin') {
    return (
      <Modal open={open} onClose={onClose} title={`${lang === 'en' ? 'Permissions for' : 'Permisos de'} ${userName}`}>
        <div className="text-center py-8">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600">
            {lang === 'en'
              ? 'Admin users have all permissions automatically.'
              : 'Los usuarios admin tienen todos los permisos automáticamente.'}
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`${lang === 'en' ? 'Permissions for' : 'Permisos de'} ${userName}`} wide>
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {permisos.length} / {Object.keys(PERMISSIONS).length} {lang === 'en' ? 'permissions active' : 'permisos activos'}
            </p>
            <div className="flex gap-2">
              <button onClick={selectAll}
                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                {lang === 'en' ? 'Select All' : 'Todos'}
              </button>
              <button onClick={deselectAll}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200">
                {lang === 'en' ? 'Deselect All' : 'Ninguno'}
              </button>
            </div>
          </div>

          {/* Permission categories */}
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
            {CATEGORIES.map((cat) => {
              const catPerms = Object.entries(PERMISSIONS).filter(([_, def]) => def.category[lang] === cat.key)
              const activeCount = catPerms.filter(([key]) => permisos.includes(key)).length
              const allActive = catPerms.length === activeCount
              const colors = colorMap[cat.color]

              return (
                <div key={cat.key} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 ${colors.bg} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className={`font-semibold text-sm ${colors.text}`}>{cat.key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {activeCount}/{catPerms.length}
                      </span>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                        allActive ? colors.toggle : 'bg-white border border-gray-300'
                      }`}>
                        {allActive && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>

                  {/* Permissions list */}
                  <div className="bg-white divide-y divide-gray-100">
                    {catPerms.map(([key, def]) => {
                      const active = permisos.includes(key)
                      return (
                        <button
                          key={key}
                          onClick={() => togglePermission(key)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">{def.label[lang]}</p>
                            <p className="text-xs text-gray-400">{def.description[lang]}</p>
                          </div>
                          <div className={`relative w-10 h-5 rounded-full transition-colors ${
                            active ? 'bg-blue-600' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              active ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {lang === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
              {saving
                ? (lang === 'en' ? 'Saving...' : 'Guardando...')
                : (lang === 'en' ? 'Save Permissions' : 'Guardar Permisos')
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
