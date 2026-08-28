import { useState } from 'react'
import {
  HelpCircle, LayoutDashboard, ShoppingCart, Lock, Package, Receipt,
  Truck, Users, FileText, BarChart3, Settings, ChevronDown, ChevronRight,
  Search, Keyboard, Bell, AlertTriangle, DollarSign, CreditCard,
  Smartphone, Printer, Eye, Edit2, Trash2, Plus, Download, Upload,
  GraduationCap, Shield, Star, Zap
} from 'lucide-react'

interface Section {
  id: string
  icon: any
  title: string
  color: string
  content: {
    title: string
    description: string
    features: string[]
    tips?: string[]
    shortcuts?: string[]
  }[]
}

const sections: Section[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    color: 'bg-blue-500',
    content: [
      {
        title: 'Resumen del Día',
        description: 'Muestra un resumen rápido de las ventas del día actual, incluyendo total de ventas, cantidad de tickets, promedio por venta y comparativa con el día anterior.',
        features: [
          'Total de ventas del día en tiempo real',
          'Número de tickets procesados',
          'Promedio de venta por ticket',
          'Comparativa porcentual con el día anterior (verde = mejor, rojo = peor)',
        ],
      },
      {
        title: 'Últimas Ventas',
        description: 'Tabla con las últimas 10 ventas realizadas, incluyendo número de ticket, cliente/método de pago, total y hora.',
        features: [
          'Número de ticket formateado (TK-001, TK-002, etc.)',
          'Método de pago utilizado',
          'Total de la venta',
          'Hora de la transacción',
        ],
      },
      {
        title: 'Alertas de Stock Bajo',
        description: 'Lista de productos que están por debajo del nivel mínimo de stock configurado. Se actualiza automáticamente.',
        features: [
          'Productos con stock igual o menor al mínimo',
          'Nombre del producto y stock actual',
          'Categoría del producto',
          'Ordenados por stock ascendente (los más críticos primero)',
        ],
        tips: [
          'Configura el stock mínimo en Inventario → Editar Producto',
          'Los productos con stock 0 aparecen primero',
          'Haz clic en un producto para ir directamente a Inventario',
        ],
      },
    ],
  },
  {
    id: 'pos',
    icon: ShoppingCart,
    title: 'Punto de Venta (POS)',
    color: 'bg-green-500',
    content: [
      {
        title: 'Búsqueda de Productos',
        description: 'Busca productos por nombre o código de barras. Si tienes lector de escáner, escanea el código directamente.',
        features: [
          'Búsqueda en tiempo real mientras escribes',
          'Resultados filtrados por nombre y código de barras',
          'Muestra categoría, stock disponible y precio',
          'Máximo 20 resultados por búsqueda',
        ],
        shortcuts: ['F2 = Enfocar búsqueda'],
      },
      {
        title: 'Carrito de Compras',
        description: 'Gestiona los productos que el cliente va a comprar. Puedes modificar cantidades, agregar descuentos por item y eliminar productos.',
        features: [
          'Agregar producto con un clic en los resultados',
          'Incrementar/decrementar cantidad con botones + y -',
          'Descuento individual por item (0-100%)',
          'Eliminar item individual o vaciar todo el carrito',
          'Validación automática de stock (no permite más de lo disponible)',
          'Productos tipo "servicio" no validan stock',
        ],
        tips: [
          'El stock se valida tanto en el frontend como en el backend',
          'Los servicios (ej: copiado) no descuentan stock',
          'Puedes aplicar descuento por item Y descuento global simultáneamente',
        ],
      },
      {
        title: 'Descuentos',
        description: 'Sistema de descuentos flexible con descuento por item y descuento global.',
        features: [
          'Descuento por item: Porcentaje sobre el precio de cada línea',
          'Descuento global: Porcentaje sobre el subtotal neto',
          'Los descuentos se acumulan (item + global)',
          'Se guardan en la venta para auditoría',
        ],
      },
      {
        title: 'Cálculo de Totales',
        description: 'El sistema calcula automáticamente subtotal, descuentos, impuestos y total.',
        features: [
          'Subtotal bruto (sin descuentos)',
          'Descuento de items individuales',
          'Descuento global aplicado',
          'Subtotal neto (después de todos los descuentos)',
          'Impuesto (Sales Tax) calculado sobre subtotal neto',
          'Total final = Subtotal neto + Impuesto',
        ],
      },
      {
        title: 'Métodos de Pago',
        description: 'Soporta múltiples métodos de pago para flexibilidad en las transacciones.',
        features: [
          'Efectivo: Ingresa el monto recibido y calcula el cambio automáticamente',
          'Transferencia: Para pagos bancarios directos',
          'Pago Móvil: Para pagos móviles (Zelle, etc.)',
          'Mixto: Para combinación de métodos',
        ],
        tips: [
          'El cambio solo se calcula en efectivo',
          'En efectivo, el botón "Confirmar" se deshabilita si el monto es insuficiente',
          'Todos los métodos registran la venta con el mismo flujo',
        ],
      },
      {
        title: 'Ticket de Venta',
        description: 'Después de procesar una venta, se muestra un preview del ticket con opción de imprimir.',
        features: [
          'Preview del ticket con formato de recibo',
          'Número de ticket formateado',
          'Detalle de items, subtotal, descuentos, impuesto y total',
          'Botón de imprimir (abre diálogo de impresión del navegador)',
          'Opción de cerrar sin imprimir',
        ],
      },
      {
        title: 'Atajos de Teclado',
        description: 'Atajos de teclado para agilizar las ventas en horarios de alta demanda.',
        shortcuts: [
          'F2 = Enfocar búsqueda de productos',
          'F5 = Abrir modal de cobro',
        ],
      },
      {
        title: 'Validación de Caja',
        description: 'El POS no funciona si no hay una caja abierta. Esto protege la integridad de los datos de caja.',
        features: [
          'Verificación automática al cargar la página',
          'Si no hay caja abierta, muestra alerta con botón para ir a Caja',
          'No permite agregar productos ni procesar ventas sin caja',
        ],
      },
    ],
  },
  {
    id: 'caja',
    icon: Lock,
    title: 'Caja',
    color: 'bg-purple-500',
    content: [
      {
        title: 'Abrir Caja',
        description: 'Inicia el día registrando el fondo inicial de efectivo. Solo puede haber una caja abierta a la vez.',
        features: [
          'Ingresa el fondo inicial (efectivo con el que comienzas)',
          'El sistema registra automáticamente la fecha y hora de apertura',
          'Validación: no permite abrir segunda caja',
          'Una vez abierta, el POS puede procesar ventas',
        ],
      },
      {
        title: 'Cerrar Caja',
        description: 'Al final del día, concilia el efectivo contado vs el efectivo esperado por el sistema.',
        features: [
          'Muestra resumen: fondo inicial + ventas + entradas - salidas',
          'Ingresa el total real contado físicamente',
          'El sistema calcula la diferencia automáticamente',
          'Diferencia positiva = sobrante, negativa = faltante',
          'Registra fecha y hora de cierre',
        ],
        tips: [
          'Cierra la caja al final de cada día para mantener datos precisos',
          'La diferencia se registra para auditoría',
          'No puedes abrir otra caja hasta cerrar la actual',
        ],
      },
      {
        title: 'Movimientos de Caja',
        description: 'Registra entradas y salidas de efectivo que no son ventas.',
        features: [
          'Entradas: Dinero extra que entra a caja (ej: cambio de proveedor)',
          'Salidas: Retiros de efectivo (ej: gastos operativos)',
          'Cada movimiento se registra con descripción y monto',
          'Los totales de caja se actualizan automáticamente',
        ],
      },
      {
        title: 'Historial de Cajas',
        description: 'Consulta el historial de todas las cajas cerradas con sus conciliaciones.',
        features: [
          'Lista de cajas con fecha de apertura y cierre',
          'Fondo inicial, total de ventas, total real, diferencia',
          'Filtros por rango de fechas',
          'Nombre del usuario que abrió/cerró la caja',
        ],
      },
      {
        title: 'Impresión de Cierre',
        description: 'Imprime un reporte detallado del cierre de caja.',
        features: [
          'Resumen de ventas del día por método de pago',
          'Entradas y salidas manuales',
          'Conciliación: esperado vs real',
          'Formato de recibo térmico',
        ],
      },
    ],
  },
  {
    id: 'inventario',
    icon: Package,
    title: 'Inventario',
    color: 'bg-orange-500',
    content: [
      {
        title: 'Gestión de Productos',
        description: 'CRUD completo de productos con toda la información necesaria para tu negocio.',
        features: [
          'Crear productos con nombre, descripción, precios, stock y categoría',
          'Editar cualquier campo del producto',
          'Eliminar (desactivar) productos — nunca se borran físicamente',
          'Búsqueda por nombre, código de barras o SKU',
          'Filtrado por categoría',
        ],
      },
      {
        title: 'Código de Barras',
        description: 'Asigna códigos de barras a tus productos para escaneo rápido en el POS.',
        features: [
          'Campo código de barras (escaneable con lector USB)',
          'Campo SKU para identificación interna',
          'Búsqueda por código de barras en el POS',
          'Productos sin código de barras se buscan por nombre',
        ],
      },
      {
        title: 'Categorías',
        description: 'Organiza tus productos en categorías para mejor gestión y reportes.',
        features: [
          'CRUD de categorías (crear, editar, desactivar)',
          'Cada producto pertenece a una categoría (opcional)',
          'Filtrado de productos por categoría',
          'Reportes de ventas por categoría',
        ],
      },
      {
        title: 'Unidades de Medida',
        description: 'Define las unidades en que mides tus productos.',
        features: [
          'Unidades predefinidas: Unidad, Paquete, Hoja, Servicio, etc.',
          'Crear unidades personalizadas con abreviatura',
          'Quick-add desde el dropdown de producto',
          'Productos tipo "servicio" no validan stock en ventas',
        ],
      },
      {
        title: 'Control de Stock',
        description: 'Monitorea el nivel de stock de cada producto.',
        features: [
          'Stock actual visible en la tabla de productos',
          'Stock mínimo configurable por producto',
          'Alertas automáticas cuando stock ≤ mínimo',
          'Productos sin stock se muestran como agotados',
        ],
      },
      {
        title: 'Ajuste de Inventario',
        description: 'Corrige el stock manualmente cuando hay discrepancias.',
        features: [
          'Botón de ajuste en cada producto',
          'Justificación obligatoria para cada ajuste',
          'Registro del stock anterior, nuevo y diferencia',
          'Historial completo de ajustes con usuario y fecha',
          'Transacción atómica (stock + registro se guardan juntos)',
        ],
        tips: [
          'Usa ajustes para: inventario físico, productos dañados, mermas',
          'Cada ajuste queda registrado para auditoría',
          'El historial se puede filtrar por producto',
        ],
      },
    ],
  },
  {
    id: 'ventas',
    icon: Receipt,
    title: 'Ventas / Historial',
    color: 'bg-teal-500',
    content: [
      {
        title: 'Lista de Ventas',
        description: 'Historial completo de todas las ventas realizadas.',
        features: [
          'Número de ticket formateado',
          'Fecha y hora de la venta',
          'Cajero que procesó la venta',
          'Método de pago utilizado',
          'Total de la venta',
          'Estado: completada o anulada',
        ],
      },
      {
        title: 'Búsqueda y Filtros',
        description: 'Encuentra ventas específicas rápidamente.',
        features: [
          'Filtro por rango de fechas (inicio y fin)',
          'Búsqueda por número de ticket',
          'Resumen del período filtrado (total ventas, monto total)',
          'Filtros rápidos: Hoy, Últimos 7 días, Últimos 30 días',
        ],
      },
      {
        title: 'Detalle de Venta',
        description: 'Visualiza el desglose completo de cada venta.',
        features: [
          'Lista de productos vendidos con cantidades y precios',
          'Descuentos aplicados (por item y global)',
          'Impuesto calculado',
          'Método de pago y monto pagado',
          'Cambio dado (en efectivo)',
        ],
      },
      {
        title: 'Anular Venta',
        description: 'Cancela una venta y devuelve el stock automáticamente.',
        features: [
          'Requiere motivo de anulación (obligatorio)',
          'Devuelve automáticamente el stock de todos los productos',
          'Marca la venta como "anulada" (no se borra)',
          'La anulación queda registrada con el motivo',
        ],
        tips: [
          'Las ventas anuladas aparecen en el historial con estado "anulada"',
          'El stock se devuelve inmediatamente',
          'Solo los admin pueden anular ventas',
        ],
      },
      {
        title: 'Re-imprimir Ticket',
        description: 'Re-imprime un ticket de venta anterior.',
        features: [
          'Selecciona cualquier venta del historial',
          'Haz clic en el icono de impresión',
          'Se abre el diálogo de impresión del navegador',
        ],
      },
    ],
  },
  {
    id: 'compras',
    icon: Truck,
    title: 'Compras',
    color: 'bg-indigo-500',
    content: [
      {
        title: 'Registrar Compra',
        description: 'Registra el ingreso de mercancía de proveedores.',
        features: [
          'Seleccionar proveedor de la lista',
          'Agregar productos con cantidad y costo unitario',
          'Número de compra automático secuencial',
          'Método de pago de la compra',
          'Notas opcionales',
        ],
      },
      {
        title: 'Actualización Automática de Stock',
        description: 'Al confirmar una compra, el stock de cada producto se incrementa automáticamente.',
        features: [
          'Stock se suma al confirmar la compra',
          'Transacción atómica (compra + stock se guardan juntos)',
          'Historial de compras con filtros de fecha',
          'Número de compra formateado',
        ],
      },
    ],
  },
  {
    id: 'proveedores',
    icon: Users,
    title: 'Proveedores',
    color: 'bg-pink-500',
    content: [
      {
        title: 'Gestión de Proveedores',
        description: 'Administra la información de tus proveedores.',
        features: [
          'Crear proveedores con nombre, EIN/RIF, teléfono, email, dirección',
          'Editar información del proveedor',
          'Desactivar proveedores (borrado lógico)',
          'Búsqueda por nombre, RIF o teléfono',
          'Vista en tarjetas con iconos',
        ],
      },
      {
        title: 'Uso en Compras',
        description: 'Los proveedores se asocian a las compras para seguimiento.',
        features: [
          'Seleccionar proveedor al crear compra',
          'Historial de compras por proveedor',
          'Información de contacto para referencia',
        ],
      },
    ],
  },
  {
    id: 'quotes',
    icon: FileText,
    title: 'Cotizaciones (Quotes)',
    color: 'bg-amber-500',
    content: [
      {
        title: 'Crear Cotización',
        description: 'Genera presupuestos para clientes antes de una venta.',
        features: [
          'Información del cliente (nombre, email, teléfono, dirección)',
          'Agregar productos con precios y cantidades',
          'Descuentos por item',
          'Fecha de vencimiento opcional',
          'Notas y observaciones',
          'Número de cotización automático',
        ],
      },
      {
        title: 'Gestionar Cotizaciones',
        description: 'Administra el estado y contenido de las cotizaciones.',
        features: [
          'Estados: Pendiente, Aprobada, Rechazada, Convertida',
          'Editar cotizaciones en estado pendiente',
          'Eliminar cotizaciones pendientes',
          'Filtros por estado y búsqueda de cliente',
        ],
      },
      {
        title: 'Imprimir Cotización',
        description: 'Genera un documento impreso de la cotización.',
        features: [
          'Formato de presupuesto profesional',
          'Detalle completo con items y totales',
          'Información del cliente',
          'Opción de imprimir directamente',
        ],
      },
    ],
  },
  {
    id: 'reportes',
    icon: BarChart3,
    title: 'Reportes',
    color: 'bg-cyan-500',
    content: [
      {
        title: 'Ventas por Período',
        description: 'Gráfico de línea que muestra las ventas diarias en un rango de fechas.',
        features: [
          'Gráfico de línea con ventas diarias',
          'Filtros rápidos: 7 días, 30 días, rango personalizado',
          'Total del período y promedio diario',
          'Selector de fechas inicio y fin',
        ],
      },
      {
        title: 'Productos Más Vendidos',
        description: 'Ranking de los productos con mayor volumen de venta.',
        features: [
          'Top 10 productos más vendidos',
          'Gráfico de barras horizontal',
          'Cantidad total vendida por producto',
          'Ingreso total generado por cada producto',
          'Filtrado por período',
        ],
      },
      {
        title: 'Métodos de Pago',
        description: 'Distribución de ventas por método de pago.',
        features: [
          'Gráfico circular (pie chart)',
          'Porcentaje de ventas por método',
          'Montos totales por cada método',
          'Comparativa visual entre efectivo, transferencia y pago móvil',
        ],
      },
      {
        title: 'Tarjetas Resumen',
        description: 'Indicadores clave del período seleccionado.',
        features: [
          'Total de ventas del período',
          'Promedio de venta diario',
          'Producto más vendido',
          'Número total de tickets',
        ],
      },
    ],
  },
  {
    id: 'config',
    icon: Settings,
    title: 'Configuración',
    color: 'bg-gray-500',
    content: [
      {
        title: 'Datos del Negocio',
        description: 'Configura la información de tu negocio que aparece en tickets y reportes.',
        features: [
          'Nombre del negocio',
          'EIN (Tax ID) — opcional',
          'Teléfono de contacto',
          'Dirección completa',
        ],
      },
      {
        title: 'Tax & Currency',
        description: 'Configura los impuestos y la moneda del sistema.',
        features: [
          'Sales Tax Rate (%) — varía por estado/condado',
          'Símbolo de moneda (default: $ USD)',
          'Referencia de tasas comunes de impuestos',
        ],
      },
      {
        title: 'Gestión de Usuarios',
        description: 'Administra los usuarios del sistema.',
        features: [
          'Crear nuevos usuarios con rol (admin/cajero)',
          'Editar nombre, rol y contraseña de usuarios',
          'Desactivar usuarios (no se borran)',
          'Roles: Admin (acceso total) vs Cajero (POS + operaciones)',
        ],
      },
      {
        title: 'Backup & Restore',
        description: 'Protege tu información con copias de seguridad.',
        features: [
          'Crear backup: copia completa de la base de datos (.db)',
          'Restaurar backup: carga un archivo .db anterior',
          'Se crea backup automático (.bak) antes de restaurar',
          'Recomendación: backup diario antes de cerrar caja',
        ],
        tips: [
          'El backup contiene TODA la información del sistema',
          'Guarda los backups en un lugar seguro (USB, nube)',
          'Nunca restaures un backup de otra versión sin verificar compatibilidad',
        ],
      },
      {
        title: 'Tutorial de Onboarding',
        description: 'Reinicia la guía interactiva para nuevos usuarios.',
        features: [
          'Botón "Reiniciar Tutorial" en la pestaña Sistema',
          'El tutorial se muestra automáticamente en el primer login',
          '5 pasos: POS, Inventario, Caja, Reportes, Configuración',
          'Útil cuando un nuevo empleado empieza a usar el sistema',
        ],
      },
    ],
  },
  {
    id: 'terminal',
    icon: CreditCard,
    title: 'Terminal VP800 (Tarjeta)',
    color: 'bg-emerald-500',
    content: [
      {
        title: 'Conexión del Terminal',
        description: 'El terminal de pago VP800 de Valor Paytech se conecta por cable USB.',
        features: [
          'Conectar el VP800 por cable USB a la PC',
          'Windows asigna automáticamente un puerto COM (ej: COM3)',
          'Abrir Administrador de Dispositivos para verificar el puerto',
          'Configurar el puerto en la app (Config → Terminal)',
        ],
        tips: [
          'El puerto COM varía según la PC — siempre verificar en Administrador de Dispositivos',
          'El terminal necesita batería cargada o estar conectado a la corriente',
          'Si el terminal no responde, reconecta el cable USB',
        ],
      },
      {
        title: 'Proceso de Pago con Tarjeta',
        description: 'Flujo completo de una transacción con tarjeta de crédito/débito.',
        features: [
          '1. El cajero selecciona "Tarjeta" como método de pago en el POS',
          '2. El sistema envía el monto al terminal VP800',
          '3. El terminal muestra "Inserte/Tarjee la tarjeta"',
          '4. El cliente pasa su tarjeta por el terminal',
          '5. El terminal procesa la transacción con el banco',
          '6. El terminal responde con aprobación o rechazo',
          '7. El sistema guarda la venta con el número de referencia bancaria',
        ],
      },
      {
        title: 'Códigos de Respuesta',
        description: 'Significado de los códigos que devuelve el terminal.',
        features: [
          '00 = Aprobado (venta exitosa)',
          '01 = Rechazado (contactar emisor)',
          '02 = Rechazado (transacción no permitida)',
          '05 = Rechazado (no honor)',
          '51 = Rechazado (fondos insuficientes)',
          '54 = Rechazado (tarjeta vencida)',
          '91 = No se pudo comunicar con el banco',
        ],
      },
      {
        title: 'Información de la Transacción',
        description: 'Datos que se registran al aprobar un pago con tarjeta.',
        features: [
          'Número de referencia bancaria (REF_NUM)',
          'Código de autorización (AUTH_CODE)',
          'Tipo de tarjeta (crédito/débito)',
          'Últimos 4 dígitos de la tarjeta',
          'Todo se guarda en la venta para auditoría',
        ],
      },
    ],
  },
  {
    id: 'seguridad',
    icon: Shield,
    title: 'Seguridad',
    color: 'bg-red-600',
    content: [
      {
        title: 'Autenticación',
        description: 'Sistema de login con contraseñas hasheadas.',
        features: [
          'Contraseñas hasheadas con bcrypt (10 salt rounds)',
          'Rate limiting: máximo 5 intentos fallidos',
          'Lockout de 15 minutos después de 5 intentos',
          'Forzar cambio de contraseña en primer login (admin)',
          'Sesión con timeout de 30 minutos de inactividad',
        ],
      },
      {
        title: 'Roles y Permisos',
        description: 'Control de acceso basado en roles.',
        features: [
          'Admin: Acceso total a todas las funciones',
          'Cajero: POS, caja, inventario básico, ventas',
          'Solo admin puede: configuración, gestión de usuarios, anular ventas',
          'Rutas protegidas en el frontend',
        ],
      },
      {
        title: 'Backup de Datos',
        description: 'Protección contra pérdida de información.',
        features: [
          'Backup manual desde Config → Sistema',
          'Restaurar desde archivo .db',
          'Backup automático antes de restaurar (.bak)',
          'Recomendación: backup diario',
        ],
      },
    ],
  },
  {
    id: 'atajos',
    icon: Keyboard,
    title: 'Atajos de Teclado',
    color: 'bg-slate-600',
    content: [
      {
        title: 'Atajos Generales',
        description: 'Teclas de acceso rápido disponibles en toda la aplicación.',
        shortcuts: [
          'F2 = Enfocar búsqueda de productos (en POS)',
          'F5 = Abrir modal de cobro (en POS)',
          'Ctrl+Shift+I = Abrir DevTools (en desarrollo)',
        ],
      },
    ],
  },
  {
    id: 'notificaciones',
    icon: Bell,
    title: 'Sistema de Notificaciones',
    color: 'bg-rose-500',
    content: [
      {
        title: 'Campana de Notificaciones',
        description: 'El icono de campana en la esquina superior derecha muestra alertas importantes.',
        features: [
          'Stock bajo: Productos por debajo del mínimo configurado',
          'Caja cerrada: Alerta cuando no hay caja abierta',
          'Se actualiza automáticamente cada minuto',
          'Click en la campana abre panel desplegable',
          'Número de notificaciones no leídas en badge rojo',
        ],
        tips: [
          'Revisa las notificaciones al inicio de cada turno',
          'Los productos con stock bajo aparecen primero',
          'La alerta de caja te recuerda abrir caja antes de vender',
        ],
      },
    ],
  },
]

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = sections.filter(s =>
    !searchTerm || s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.content.some(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-blue-600" /> Centro de Ayuda
        </h1>
        <p className="text-sm text-gray-500 mt-1">Guía completa de uso de TOG Admin</p>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar en la ayuda..."
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Secciones */}
      <div className="space-y-3">
        {filtered.map((section) => {
          const Icon = section.icon
          const isOpen = activeSection === section.id
          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setActiveSection(isOpen ? null : section.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`${section.color} p-2 rounded-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-xs text-gray-500">{section.content.length} secciones</p>
                </div>
                {isOpen
                  ? <ChevronDown className="w-5 h-5 text-gray-400" />
                  : <ChevronRight className="w-5 h-5 text-gray-400" />
                }
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
                  {(section.content || []).map((item, i) => (
                    <div key={i} className="pt-4">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                      {/* Features */}
                      <div className="space-y-1.5">
                        {(item.features || []).map((f, j) => (
                          <div key={j} className="flex items-start gap-2 text-sm text-gray-700">
                            <Zap className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      {/* Tips */}
                      {(item.tips || []).length > 0 && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-700 mb-1.5">💡 Tips</p>
                          {(item.tips || []).map((tip, j) => (
                            <p key={j} className="text-xs text-blue-600">• {tip}</p>
                          ))}
                        </div>
                      )}

                      {/* Shortcuts */}
                      {(item.shortcuts || []).length > 0 && (
                        <div className="mt-3 bg-gray-100 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1.5">⌨️ Atajos</p>
                          {(item.shortcuts || []).map((s, j) => (
                            <p key={j} className="text-xs text-gray-600 font-mono">• {s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 py-4">
        <p>TOG Admin v1.0.0 — Sistema de Punto de Venta</p>
        <p className="mt-1">¿Necesitas más ayuda? Contacta al administrador del sistema.</p>
      </div>
    </div>
  )
}
