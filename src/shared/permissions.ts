/**
 * Sistema de permisos por función para TOG Admin POS.
 *
 * Cada usuario tiene un JSON de permisos almacenado en la DB.
 * El admin tiene todos los permisos por defecto.
 * El cajero tiene permisos limitados por defecto.
 *
 * Para agregar un permiso nuevo:
 * 1. Agregarlo aquí en PERMISSIONS
 * 2. Agregarlo al default del rol correspondiente en ROLE_DEFAULTS
 * 3. Usar hasPermission() para verificarlo en el frontend/backend
 */

// Todos los permisos disponibles
export const PERMISSIONS = {
  // === VENTAS / POS ===
  pos_access: {
    label: { es: 'Usar Punto de Venta', en: 'Use Point of Sale' },
    category: { es: 'Ventas', en: 'Sales' },
    description: { es: 'Acceder al módulo de POS y procesar ventas', en: 'Access POS module and process sales' },
  },
  pos_void_sale: {
    label: { es: 'Anular Ventas', en: 'Void Sales' },
    category: { es: 'Ventas', en: 'Sales' },
    description: { es: 'Anular/devolver ventas registradas', en: 'Void/return registered sales' },
  },
  pos_discount: {
    label: { es: 'Aplicar Descuentos', en: 'Apply Discounts' },
    category: { es: 'Ventas', en: 'Sales' },
    description: { es: 'Aplicar descuentos por item o globales', en: 'Apply item or global discounts' },
  },
  pos_edit_price: {
    label: { es: 'Editar Precio en Venta', en: 'Edit Sale Price' },
    category: { es: 'Ventas', en: 'Sales' },
    description: { es: 'Cambiar el precio unitario al vender', en: 'Change unit price when selling' },
  },
  pos_quick_sale: {
    label: { es: 'Venta Rápida (Servicio)', en: 'Quick Sale (Service)' },
    category: { es: 'Ventas', en: 'Sales' },
    description: { es: 'Agregar servicios/manuales al carrito', en: 'Add services/manual items to cart' },
  },

  // === CAJA ===
  caja_access: {
    label: { es: 'Usar Módulo de Caja', en: 'Use Cash Register' },
    category: { es: 'Caja', en: 'Cash Register' },
    description: { es: 'Acceder al módulo de caja', en: 'Access cash register module' },
  },
  caja_open: {
    label: { es: 'Abrir Caja', en: 'Open Register' },
    category: { es: 'Caja', en: 'Cash Register' },
    description: { es: 'Abrir caja con fondo inicial', en: 'Open register with initial float' },
  },
  caja_close: {
    label: { es: 'Cerrar Caja', en: 'Close Register' },
    category: { es: 'Caja', en: 'Cash Register' },
    description: { es: 'Cerrar caja y hacer conciliación', en: 'Close register and reconcile' },
  },
  caja_movement: {
    label: { es: 'Movimientos de Caja', en: 'Register Movements' },
    category: { es: 'Caja', en: 'Cash Register' },
    description: { es: 'Registrar entradas, retiros y notas', en: 'Record entries, withdrawals and notes' },
  },
  caja_report_x: {
    label: { es: 'Reporte X (Parcial)', en: 'X Report (Partial)' },
    category: { es: 'Caja', en: 'Cash Register' },
    description: { es: 'Ver reporte parcial sin cerrar caja', en: 'View partial report without closing' },
  },

  // === INVENTARIO ===
  inventario_access: {
    label: { es: 'Usar Módulo de Inventario', en: 'Use Inventory Module' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Acceder al módulo de inventario', en: 'Access inventory module' },
  },
  inventario_create: {
    label: { es: 'Crear Productos', en: 'Create Products' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Agregar nuevos productos al inventario', en: 'Add new products to inventory' },
  },
  inventario_edit: {
    label: { es: 'Editar Productos', en: 'Edit Products' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Modificar información de productos existentes', en: 'Modify existing product information' },
  },
  inventario_delete: {
    label: { es: 'Eliminar Productos', en: 'Delete Products' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Eliminar productos del inventario', en: 'Delete products from inventory' },
  },
  inventario_adjust: {
    label: { es: 'Ajustar Stock', en: 'Adjust Stock' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Ajustar stock manualmente con justificación', en: 'Manually adjust stock with justification' },
  },
  inventario_categories: {
    label: { es: 'Gestionar Categorías', en: 'Manage Categories' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Crear, editar y eliminar categorías', en: 'Create, edit and delete categories' },
  },
  inventario_units: {
    label: { es: 'Gestionar Unidades', en: 'Manage Units' },
    category: { es: 'Inventario', en: 'Inventory' },
    description: { es: 'Crear, editar y eliminar unidades de medida', en: 'Create, edit and delete units of measure' },
  },

  // === COMPRAS ===
  compras_access: {
    label: { es: 'Usar Módulo de Compras', en: 'Use Purchases Module' },
    category: { es: 'Compras', en: 'Purchases' },
    description: { es: 'Acceder al módulo de compras', en: 'Access purchases module' },
  },
  compras_create: {
    label: { es: 'Registrar Compras', en: 'Register Purchases' },
    category: { es: 'Compras', en: 'Purchases' },
    description: { es: 'Crear nuevas compras y actualizar stock', en: 'Create new purchases and update stock' },
  },
  compras_suppliers: {
    label: { es: 'Gestionar Proveedores', en: 'Manage Suppliers' },
    category: { es: 'Compras', en: 'Purchases' },
    description: { es: 'Crear, editar y eliminar proveedores', en: 'Create, edit and delete suppliers' },
  },

  // === COTIZACIONES ===
  quotes_access: {
    label: { es: 'Usar Cotizaciones', en: 'Use Quotes' },
    category: { es: 'Cotizaciones', en: 'Quotes' },
    description: { es: 'Acceder al módulo de cotizaciones', en: 'Access quotes module' },
  },
  quotes_create: {
    label: { es: 'Crear Cotizaciones', en: 'Create Quotes' },
    category: { es: 'Cotizaciones', en: 'Quotes' },
    description: { es: 'Crear nuevas cotizaciones para clientes', en: 'Create new quotes for customers' },
  },

  // === REPORTES ===
  reportes_access: {
    label: { es: 'Ver Reportes', en: 'View Reports' },
    category: { es: 'Reportes', en: 'Reports' },
    description: { es: 'Acceder al módulo de reportes y gráficas', en: 'Access reports and charts module' },
  },
  reportes_export: {
    label: { es: 'Exportar Reportes', en: 'Export Reports' },
    category: { es: 'Reportes', en: 'Reports' },
    description: { es: 'Exportar reportes a CSV o PDF', en: 'Export reports to CSV or PDF' },
  },

  // === CONFIGURACIÓN / ADMIN ===
  config_access: {
    label: { es: 'Ver Configuración', en: 'View Settings' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Acceder a la configuración del sistema', en: 'Access system settings' },
  },
  config_edit: {
    label: { es: 'Editar Configuración', en: 'Edit Settings' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Modificar datos del negocio, impuestos, impresora', en: 'Modify business data, taxes, printer' },
  },
  config_terminal: {
    label: { es: 'Configurar Terminal VP800', en: 'Configure VP800 Terminal' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Configurar conexión del terminal de cobro', en: 'Configure payment terminal connection' },
  },
  config_backup: {
    label: { es: 'Gestionar Backups', en: 'Manage Backups' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Crear, restaurar y gestionar copias de seguridad', en: 'Create, restore and manage backups' },
  },
  config_db_reset: {
    label: { es: 'Resetear Base de Datos', en: 'Reset Database' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Borrar y reiniciar la base de datos (PELIGROSO)', en: 'Delete and reset database (DANGEROUS)' },
  },

  // === USUARIOS ===
  usuarios_access: {
    label: { es: 'Gestionar Usuarios', en: 'Manage Users' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Crear, editar, eliminar usuarios y permisos', en: 'Create, edit, delete users and permissions' },
  },
  usuarios_manage_roles: {
    label: { es: 'Asignar Permisos', en: 'Assign Permissions' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Modificar permisos de otros usuarios', en: 'Modify other users permissions' },
  },
  usuarios_change_own_password: {
    label: { es: 'Cambiar propia contraseña', en: 'Change Own Password' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Permite a cualquier usuario cambiar su propia contraseña', en: 'Allows any user to change their own password' },
  },

  // === COTIZACIONES (granularidad fina) ===
  quotes_edit: {
    label: { es: 'Editar Cotizaciones', en: 'Edit Quotes' },
    category: { es: 'Cotizaciones', en: 'Quotes' },
    description: { es: 'Modificar cotizaciones existentes', en: 'Modify existing quotes' },
  },
  quotes_delete: {
    label: { es: 'Eliminar Cotizaciones', en: 'Delete Quotes' },
    category: { es: 'Cotizaciones', en: 'Quotes' },
    description: { es: 'Eliminar cotizaciones (acción destructiva)', en: 'Delete quotes (destructive action)' },
  },

  // === LICENCIA ===
  license_manage: {
    label: { es: 'Gestionar Licencia', en: 'Manage License' },
    category: { es: 'Administración', en: 'Administration' },
    description: { es: 'Importar, resetear o manipular la licencia del producto', en: 'Import, reset or manipulate the product license' },
  },

  // === DISTRIBUIDOR ===
  distribuidor_clientes_view: {
    label: { es: 'Ver Clientes', en: 'View Clients' },
    category: { es: 'Distribuidor', en: 'Distributor' },
    description: { es: 'Ver clientes del módulo Distribuidor', en: 'View Distributor module clients' },
  },
  distribuidor_clientes_edit: {
    label: { es: 'Crear/Editar Clientes', en: 'Create/Edit Clients' },
    category: { es: 'Distribuidor', en: 'Distributor' },
    description: { es: 'Crear y editar clientes del módulo Distribuidor', en: 'Create and edit Distributor clients' },
  },
  distribuidor_pedidos_view: {
    label: { es: 'Ver Pedidos', en: 'View Orders' },
    category: { es: 'Distribuidor', en: 'Distributor' },
    description: { es: 'Ver pedidos del módulo Distribuidor', en: 'View Distributor orders' },
  },
  distribuidor_pedidos_edit: {
    label: { es: 'Crear/Editar Pedidos', en: 'Create/Edit Orders' },
    category: { es: 'Distribuidor', en: 'Distributor' },
    description: { es: 'Crear, editar y despachar pedidos', en: 'Create, edit and dispatch orders' },
  },
} as const

export type PermissionKey = keyof typeof PERMISSIONS

// Permisos por defecto para cada rol
export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  admin: Object.keys(PERMISSIONS) as PermissionKey[], // Admin tiene TODO
  cajero: [
    'pos_access',
    'pos_discount',
    'pos_edit_price',
    'pos_quick_sale',
    'caja_access',
    'caja_open',
    'caja_close',
    'caja_movement',
    'caja_report_x',
    'inventario_access',
    'inventario_create',
    'inventario_edit',
    'compras_access',
    'compras_create',
    'quotes_access',
    'quotes_create',
    'reportes_access',
    'usuarios_change_own_password',
  ],
}

// Categorías de permisos (para agrupar en la UI)
export const PERMISSION_CATEGORIES = [
  { key: 'Ventas', icon: '🛒', color: 'blue' },
  { key: 'Caja', icon: '💰', color: 'green' },
  { key: 'Inventario', icon: '📦', color: 'purple' },
  { key: 'Compras', icon: '🚚', color: 'orange' },
  { key: 'Cotizaciones', icon: '📝', color: 'cyan' },
  { key: 'Reportes', icon: '📊', color: 'indigo' },
  { key: 'Distribuidor', icon: '🚚', color: 'orange' },
  { key: 'Administración', icon: '⚙️', color: 'red' },
] as const

/**
 * Verifica si un usuario tiene un permiso específico.
 * @param userPermissions - Array de permisos del usuario (o null para admin)
 * @param permission - Permiso a verificar
 * @param userRole - Rol del usuario ('admin' | 'cajero')
 */
export function hasPermission(
  userPermissions: string[] | null,
  permission: PermissionKey,
  userRole: string,
): boolean {
  // Admin siempre tiene todos los permisos
  if (userRole === 'admin') return true

  // Si no hay permisos definidos, usar los defaults del rol
  const perms = userPermissions ?? ROLE_DEFAULTS[userRole] ?? []
  return perms.includes(permission)
}

/**
 * Obtiene los permisos efectivos de un usuario.
 * Si el usuario no tiene permisos guardados, retorna los defaults del rol.
 */
export function getEffectivePermissions(
  userPermissions: string | null,
  userRole: string,
): PermissionKey[] {
  if (userRole === 'admin') return Object.keys(PERMISSIONS) as PermissionKey[]

  if (!userPermissions) {
    return ROLE_DEFAULTS[userRole] ?? []
  }

  try {
    return JSON.parse(userPermissions) as PermissionKey[]
  } catch {
    return ROLE_DEFAULTS[userRole] ?? []
  }
}
