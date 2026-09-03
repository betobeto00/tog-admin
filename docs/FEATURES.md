# Features — TOG Admin

## Prioridades

- 🔴 **P0** — MVP, indispensable para operar
- 🟡 **P1** — Importante, agregar en fase 2
- 🟢 **P2** — Deseable, agregar después
- 🔵 **P3** — Futuro, expansión del sistema

---

## Módulo: Autenticación 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| A1 | Login con usuario/contraseña | 🔴 | ✅ | Pantalla de acceso con credenciales |
| A2 | Sesión con timeout | 🔴 | ✅ | 30 min de inactividad auto-logout |
| A3 | Roles básico | 🔴 | ✅ | Admin (acceso total) vs Cajero (solo POS + caja) |
| A4 | Cambio de contraseña | 🟡 | ✅ | El usuario puede cambiar su propia contraseña |
| A5 | Rate limiting login | 🔴 | ✅ | Bloqueo después de 5 intentos fallidos |
| A6 | Forzar cambio password | 🔴 | ✅ | Admin debe cambiar password en primer login |

---

## Módulo: Punto de Venta (POS) 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| P1 | Carrito de compras | 🔴 | ✅ | Agregar, modificar cantidad, eliminar items |
| P2 | Búsqueda de productos | 🔴 | ✅ | Por código de barras, nombre, SKU |
| P3 | Precio unitario editable | 🔴 | ✅ | Permite cambiar precio en venta directamente en el carrito |
| P4 | Descuento por item | 🔴 | ✅ | Descuento individual por línea (%) |
| P5 | Descuento global | 🔴 | ✅ | Descuento sobre subtotal (%) |
| P6 | Múltiples métodos de pago | 🔴 | ✅ | Efectivo, transferencia, pago móvil, mixto, tarjeta (configurable) |
| P7 | Cálculo de cambio | 🔴 | ✅ | Auto-calcula vuelto en efectivo |
| P8 | Ticket impreso | 🔴 | ✅ | Preview del ticket + impresión |
| P9 | Ticket sin imprimir | 🔴 | ✅ | Cerrar modal sin imprimir |
| P10 | Venta rápida sin producto | 🔴 | ✅ | Botón "Venta Rápida" para servicios por cobrar sin crear producto |
| P11 | Modo touch | 🟡 | ⏳ | Botones grandes para pantalla táctil |
| P12 | Atajos de teclado | 🟡 | ✅ | F2=buscar, F5=cobrar |
| P13 | Venta a crédito/fiado | 🟡 | ⏳ | Registrar venta sin cobro inmediato |
| P14 | Tarjeta (VP800) | 🟡 | ✅ | Integración con terminal Valor VP800 (USB/COM) |
| P15 | Componente CartItem | 🟢 | ✅ | Subcomponente extraído para reutilización |
| P16 | POS bloqueado sin caja | 🔴 | ✅ | No funciona si no hay caja abierta |
| P17 | **Escáner código de barras USB** | 🟡 | ✅ | Hook useBarcodeScanner, scan → buscar → agregar al carrito |
| P18 | **Escáner en creación de producto** | 🟡 | ✅ | Escanear código al crear producto, auto-fill campo código barras |
| P19 | **Escáner en compras** | 🟡 | ✅ | Escanear código para agregar producto a la compra |

---

## Módulo: Productos / Inventario 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| I1 | CRUD de productos | 🔴 | ✅ | Crear, leer, actualizar, eliminar productos |
| I2 | Código de barras | 🔴 | ✅ | Asignar y buscar por código de barras |
| I3 | Categorías | 🔴 | ✅ | CRUD de categorías |
| I3b | Unidades de Medida | 🔴 | ✅ | CRUD dinámico + quick-add desde dropdown |
| I4 | Stock actual | 🔴 | ✅ | Visualizar stock en tabla |
| I5 | Stock mínimo | 🔴 | ✅ | Alerta cuando stock < mínimo |
| I6 | Importar productos | 🟡 | ✅ | Cargar desde archivo CSV con validación |
| I7 | Exportar productos | 🟡 | ✅ | Exportar inventario completo a CSV |
| I8 | Imprimir etiquetas | 🟡 | ⏳ | Etiquetas con código de barras |
| I9 | Historial de movimientos | 🟡 | ✅ | Registro de cada ajuste de stock con justificación |
| I10 | Ajuste de inventario | 🔴 | ✅ | Corregir stock manualmente con justificación |
| I11 | Productos sin stock | 🟡 | ✅ | Filtro "Stock Bajo" para ver productos por debajo del mínimo |
| I12 | **Tipo producto/servicio** | 🔴 | ⏳ | Identificar si es producto físico o servicio (Fase 5) |
| I13 | **Subcategorías** | 🔴 | ⏳ | Subcategorías de productos (Fase 5) |
| I14 | **Marca del producto** | 🟡 | ⏳ | Campo opcional de marca (Fase 5) |
| I15 | **Imagen del producto** | 🟡 | ⏳ | Subir imagen del producto (Fase 5) |

---

## Módulo: Caja 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| C1 | Abrir caja | 🔴 | ✅ | Registrar fondo inicial |
| C2 | Cerrar caja | 🔴 | ✅ | Conciliación: esperado vs real |
| C3 | Resumen del día | 🔴 | ✅ | Total ventas, entradas, salidas, diferencia |
| C4 | Entradas manuales | 🔴 | ✅ | Registrar dinero extra que entra a caja |
| C5 | Salidas / Retiros | 🔴 | ✅ | Registrar retiros de efectivo |
| C6 | Solo una caja abierta | 🔴 | ✅ | No permitir segunda apertura |
| C7 | Historial de cajas | 🔴 | ✅ | Ver cajas cerradas anteriores |
| C8 | Impresión de cierre | 🟡 | ✅ | Imprimir reporte de cierre de caja |
| C9 | Reporte X (parcial) | 🟡 | ✅ | Ver total sin cerrar caja (ventas por método + movimientos) |

---

## Módulo: Ventas / Historial 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| V1 | Lista de ventas del día | 🔴 | ✅ | Todas las ventas con filtros |
| V2 | Búsqueda de venta | 🔴 | ✅ | Por número, cajero, método de pago |
| V3 | Detalle de venta | 🔴 | ✅ | Ver items de cada venta |
| V4 | Anular venta | 🔴 | ✅ | Cancelar y devolver stock (con motivo) |
| V5 | Re-imprimir ticket | 🔴 | ✅ | Re-imprimir ticket de venta |
| V6 | Ventas por período | 🔴 | ✅ | Filtrar por rango de fechas |
| V7 | Métodos de pago | 🟡 | ✅ | Filtrar ventas por método de pago |
| V8 | Resumen del filtro | 🟡 | ✅ | Conteo y total del período filtrado |

---

## Módulo: Compras 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| CP1 | Registrar compras | 🔴 | ✅ | Crear compra con items y actualizar stock |
| CP2 | Historial de compras | 🔴 | ✅ | Lista de compras con filtros |
| CP3 | Proveedor asociado | 🔴 | ✅ | Seleccionar proveedor al registrar compra |
| CP4 | Escáner en compras | 🟡 | ✅ | Escanear código de barras para agregar producto |

---

## Módulo: Proveedores 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| PR1 | CRUD de proveedores | 🔴 | ✅ | Crear, editar, eliminar proveedores |
| PR2 | Datos de contacto | 🔴 | ✅ | Nombre, EIN, teléfono, email, dirección |
| PR3 | Notas | 🟢 | ✅ | Campo de notas para cada proveedor |

---

## Módulo: Distribuidor 🟡 (adicional por licencia)

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| D1 | CRUD de clientes | 🔴 | ✅ | Crear, editar, eliminar (borrado lógico); documento de registro internacional (RIF, RFC, EIN, CNPJ…) |
| D2 | Listado y búsqueda de clientes | 🔴 | ✅ | Filtrar por nombre, documento o teléfono |
| D3 | Crear pedido con líneas | 🔴 | ✅ | Catálogo de productos del Core (no requiere permiso de inventario); precio autocompletado |
| D4 | Numeración secuencial de pedidos | 🔴 | ✅ | `configuracion.pedido_numero`, idempotente |
| D5 | Estados de pedido | 🔴 | ✅ | `pendiente` → `despachado` → `entregado`; anulación; validación de transiciones |
| D6 | Gating por licencia y permisos | 🔴 | ✅ | Menú/rutas/handlers solo si el módulo viene en la licencia y el usuario tiene permiso `distribuidor_*` |

---

## Módulo: Cotizaciones 🟡

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| Q1 | Crear cotización | 🟡 | ✅ | Crear presupuesto con items, cliente, validez |
| Q2 | Lista de cotizaciones | 🟡 | ✅ | Ver todas las cotizaciones con filtros |
| Q3 | Detalle de cotización | 🟡 | ✅ | Ver items y totales |
| Q4 | Editar cotización | 🟡 | ✅ | Modificar cotización existente |
| Q5 | Eliminar cotización | 🟡 | ✅ | Eliminar cotización |
| Q6 | Exportar cotización a PDF | 🔴 | ⏳ | Generar PDF profesional con template (Fase 6) |
| Q7 | Convertir cotización a venta | 🟡 | ⏳ | From QuotesPage → crear venta (Fase 6) |

---

## Módulo: Reportes 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| R1 | Ventas por período | 🔴 | ✅ | Filtrar por rango de fechas |
| R2 | Productos más vendidos | 🔴 | ✅ | Top productos por cantidad |
| R3 | Últimas ventas | 🔴 | ✅ | Últimas 10 ventas en Dashboard |
| R4 | Exportar CSV | 🟡 | ✅ | Exportar datos de reportes a CSV |
| R5 | Exportar PDF | 🟡 | ✅ | Exportar reportes a PDF |
| R6 | Gráficas de ventas | 🟡 | ✅ | Recharts con gráficas de tendencia |
| R7 | Reportes avanzados | 🟡 | ⏳ | Comparativas, tendencias, exportación avanzada |

---

## Módulo: Configuración 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| CF1 | Datos del negocio | 🔴 | ✅ | Nombre, dirección, teléfono, EIN, logo |
| CF2 | Impuestos | 🔴 | ✅ | Configurar tasa de impuesto |
| CF3 | Impresora | 🟡 | ✅ | Configurar nombre de impresora térmica |
| CF4 | Fondo inicial default | 🟡 | ✅ | Configurar fondo de caja por defecto |
| CF5 | Terminal VP800 | 🟡 | ✅ | Configurar puerto COM, baud rate, conectar/desconectar |
| CF6 | Backup/Restore | 🔴 | ✅ | Crear y restaurar copias de seguridad |
| CF7 | Gestión de usuarios | 🔴 | ✅ | CRUD de usuarios con roles y permisos |
| CF8 | Tutorial | 🟢 | ✅ | Onboarding de 5 pasos |
| CF9 | Métodos de pago | 🟡 | ✅ | Configurar métodos de pago (efectivo, tarjeta, etc.) |
| CF10 | **Tasa de cambio** | 🔴 | ⏳ | Configurar tasa de cambio y símbolo de moneda (Fase 8) |
| CF11 | **Módulos de TOG Platform** | 🔴 | ✅ | Catálogo de módulos por licencia (estado, importar v2, **Sincronizar** desde el backend) |

---

## Módulo: Seguridad 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| SEC1 | Sistema de licencias RSA-2048 | 🔴 | ✅ | Licencias offline con validación de firma + **Sincronizar** (canal pre-auth `license:sync`, re-validación RSA local) |
| SEC2 | Permisos por usuario (39 permisos) | 🟡 | ✅ | 10 categorías de permisos granulares (incl. `distribuidor_*`) |
| SEC3 | Rate limiting en login | 🔴 | ✅ | Bloqueo después de 5 intentos |
| SEC4 | Session timeout | 🔴 | ✅ | 30 min de inactividad |
| SEC5 | Password hashing (bcrypt) | 🔴 | ✅ | 10 salt rounds |
| SEC6 | ErrorBoundary + Crash Reports | 🟡 | ✅ | Captura de errores + reportes automáticos |
| SEC7 | CSP headers | 🟢 | ⏳ | Content Security Policy |
| SEC8 | Validar origen IPC | 🟢 | ⏳ | webContents.getURL validation |

---

## Módulo: Infraestructura 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| INF1 | Auto-update (electron-updater) | 🟡 | ✅ | Actualizaciones vía GitHub Releases |
| INF2 | NSIS installer | 🟡 | ✅ | Instalador Windows con acceso directo |
| INF3 | i18n (ES/EN) | 🟡 | ✅ | ~1,329 keys por idioma (ES/EN) |
| INF4 | Tests automatizados | 🟡 | ✅ | 159 tests (Vitest: validaciones, servicios, handlers IPC, componentes) |
| INF5 | Build portable | 🟢 | ✅ | Versión sin instalador |
| INF6 | Instalador X32 | 🟡 | ⏳ | Instalador para arquitectura de 32 bits |
| INF7 | Logging estructurado (winston) | 🟡 | ⏳ | Logging centralizado en main process |
| INF8 | Multi-plataforma (Mac/Linux) | 🟢 | ⏳ | Soporte para macOS y Linux |

---

## Módulo: Futuro / Expansión 🔵

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| F1 | Combos de productos | 🔴 | ⏳ | Paquetes de productos con descuento (Fase 6) |
| F2 | Multi-sucursal | 🟡 | ⏳ | Varias ubicaciones con DB compartida (Fase 7) |
| F3 | Pantalla auxiliar | 🟢 | ⏳ | Segunda pantalla para clientes (Fase 9) |
| F4 | Facturación fiscal Venezuela | 🔴 | ⏳ | Comprobante fiscal válido (Fase 8) |
| F5 | CSV formato SENIAT | 🟡 | ⏳ | Exportar para declaración de impuestos (Fase 8) |
| F6 | Modo touch | 🟡 | ⏳ | Optimizado para tablet/pantalla táctil (Fase 3) |
| F7 | Venta a crédito/fiado | 🟡 | ⏳ | Cuentas por cobrar (Fase 3) |
| F8 | Imprimir etiquetas | 🟡 | ⏳ | Etiquetas con código de barras (Fase 3) |
| F9 | WiFi para VP800 | 🟡 | ⏳ | Comunicación WiFi vía Valor Connect (Fase 3) |

---

## Resumen de Estado

| Categoría | Total | ✅ Completado | ⏳ Pendiente |
|-----------|-------|--------------|-------------|
| Autenticación | 6 | 6 | 0 |
| POS | 19 | 16 | 3 |
| Inventario | 15 | 11 | 4 |
| Caja | 9 | 9 | 0 |
| Ventas | 8 | 8 | 0 |
| Compras | 4 | 4 | 0 |
| Proveedores | 3 | 3 | 0 |
| Distribuidor | 6 | 6 | 0 |
| Cotizaciones | 7 | 5 | 2 |
| Reportes | 7 | 6 | 1 |
| Configuración | 11 | 10 | 1 |
| Seguridad | 8 | 6 | 2 |
| Infraestructura | 8 | 5 | 3 |
| Futuro/Expansión | 9 | 0 | 9 |
| **TOTAL** | **120** | **95** | **25** |

**Porcentaje completado: 79.2%**
