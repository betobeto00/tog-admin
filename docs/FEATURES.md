# Features — TOG Admin

## Prioridades

- 🔴 **P0** — MVP, indispensable para operar
- 🟡 **P1** — Importante, agregar en fase 2
- 🟢 **P2** — Deseable, agregar después

---

## Módulo: Autenticación 🔴

| # | Feature | Prioridad | Descripción |
|---|---------|-----------|-------------|
| A1 | Login con usuario/contraseña | 🔴 | Pantalla de acceso con credenciales |
| A2 | Sesión con timeout | 🔴 | Cerrar sesión tras inactividad (configurable) |
| A3 | Roles básico | 🔴 | Admin (acceso total) vs Cajero (solo POS + caja) |
| A4 | Cambio de contraseña | 🟡 | El usuario puede cambiar su propia contraseña |

---

## Módulo: Punto de Venta (POS) 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| P1 | Carrito de compras | 🔴 | ✅ | Agregar, modificar cantidad, eliminar items |
| P2 | Búsqueda de productos | 🔴 | ✅ | Por código de barras, nombre, SKU |
| P3 | Precio unitario editable | 🔴 | ⏳ | Permite cambiar precio en venta (con permiso) |
| P4 | Descuento por item | 🔴 | ⏳ | Descuento individual por línea |
| P5 | Descuento global | 🔴 | ⏳ | Descuento sobre el total |
| P6 | Múltiples métodos de pago | 🔴 | ✅ | Efectivo, transferencia, pago móvil, mixto |
| P7 | Cálculo de cambio | 🔴 | ✅ | Auto-calcula vuelto en efectivo |
| P8 | Ticket impreso | 🔴 | ✅ | Preview del ticket + impresión |
| P9 | Ticket sin imprimir | 🔴 | ✅ | Cerrar modal sin imprimir |
| P10 | Venta rápida sin producto | 🔴 | ⏳ | Ingreso manual de monto (servicios por cobrar) |
| P11 | Modo touch | 🟡 | ⏳ | Botones grandes para pantalla táctil |
| P12 | Atajos de teclado | 🟡 | ✅ | F2=buscar, F5=cobrar |
| P13 | Venta a crédito/fiado | 🟡 | ⏳ | Registrar venta sin cobro inmediato |

---

## Módulo: Productos / Inventario 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| I1 | CRUD de productos | 🔴 | ✅ | Crear, leer, actualizar, eliminar productos |
| I2 | Código de barras | 🔴 | ✅ | Asignar y buscar por código de barras |
| I3 | Categorías | 🔴 | ✅ | CRUD de categorías |
| I3b | Unidades de Medida | 🔴 | ✅ | CRUD dinámico + quick-add desde dropdown de producto |
| I4 | Stock actual | 🔴 | ✅ | Visualizar stock en tabla |
| I5 | Stock mínimo | 🔴 | ✅ | Alerta cuando stock < mínimo |
| I6 | Importar productos | 🟡 | ⏳ | Cargar desde archivo CSV/Excel |
| I7 | Exportar productos | 🟡 | ⏳ | Exportar inventario a CSV/Excel |
| I8 | Imprimir etiquetas | 🟡 | ⏳ | Etiquetas con código de barras |
| I9 | Historial de movimientos | 🟡 | ⏳ | Registro de cada cambio de stock |
| I10 | Ajuste de inventario | 🔴 | ⏳ | Corregir stock manualmente con justificación |
| I11 | Productos sin stock | 🟡 | ⏳ | Marcar como "agotado" y filtrar |

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
| C8 | Impresión de cierre | 🟡 | ⏳ | Imprimir reporte de cierre de caja |
| C9 | Reporte X (parcial) | 🟡 | ⏳ | Ver total sin cerrar caja |

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
| CO1 | Registrar compra | 🔴 | ✅ | Nuevo ingreso de mercancía |
| CO2 | Seleccionar proveedor | 🔴 | ✅ | Asociar compra a proveedor |
| CO3 | Agregar items | 🔴 | ✅ | Búsqueda, cantidad, costo unitario |
| CO4 | Actualizar stock automático | 🔴 | ✅ | Sumar stock al confirmar compra |
| CO5 | Historial de compras | 🔴 | ✅ | Con filtros de fecha |
| CO6 | Nota de entrega | 🟡 | ⏳ | Imprimir documento de recepción |

---

## Módulo: Proveedores 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| PR1 | CRUD de proveedores | 🔴 | ✅ | Crear, editar, desactivar |
| PR2 | Contacto (tel, email, dirección) | 🔴 | ✅ | Datos completos del proveedor |
| PR3 | Tarjetas de proveedores | 🔴 | ✅ | Vista en tarjetas con iconos |
| PR4 | Búsqueda | 🔴 | ✅ | Por nombre, RIF, teléfono |

---

## Módulo: Reportes 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| R1 | Ventas del día | 🔴 | ✅ | Resumen del día actual |
| R2 | Ventas por período | 🔴 | ✅ | Gráfico de líneas con ingresos diarios |
| R3 | Productos más vendidos | 🔴 | ✅ | Top 10 con gráfico de barras |
| R4 | Métodos de pago | 🔴 | ✅ | Gráfico pie (efectivo/transferencia/móvil) |
| R5 | Tarjetas resumen | 🔴 | ✅ | Total período, promedio diario, top producto |
| R6 | Filtros rápidos | 🔴 | ✅ | Últimos 7 días, 30 días, rango custom |
| R7 | Ventas por categoría | 🟡 | ⏳ | Qué categorías generan más |
| R8 | Margen de ganancia | 🟡 | ⏳ | Ganancia real vs esperada |
| R9 | Exportar reportes | 🟡 | ⏳ | PDF o Excel |

---

## Módulo: Configuración 🔴

| # | Feature | Prioridad | Descripción |
|---|---------|-----------|-------------|
| CF1 | Datos del negocio | 🔴 | ✅ | Business name, EIN, address, phone |
| CF2 | Gestión de usuarios | 🔴 | ✅ | CRUD users, roles admin/cashier, change password |
| CF3 | Sales Tax | 🔴 | ✅ | Configurable rate by state (default 0%) |
| CF4 | Moneda | 🔴 | ✅ | Currency symbol (default $ USD) |
| CF5 | Parámetros de caja | 🟡 | ⏳ | Fondo inicial default |
| CF6 | Backup manual | 🔴 | Crear copia de seguridad ahora |
| CF7 | Backup automático | 🟡 | Al cerrar caja o programado |
| CF8 | Restaurar backup | 🔴 | Cargar archivo .db de respaldo |
| CF9 | Configurar impresora | 🟡 | Seleccionar impresora térmica |

## Módulo: Quotes / Presupuestos 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| Q1 | Crear quote | 🔴 | ✅ | Cliente, items, notas, fecha de vencimiento |
| Q2 | Ver quote | 🔴 | ✅ | Detalle completo con items y totales |
| Q3 | Editar quote | 🔴 | ✅ | Solo quotes en estado pendiente |
| Q4 | Cambiar estado | 🔴 | ✅ | Pendiente → Aprobada / Rechazada / Convertida |
| Q5 | Imprimir quote | 🔴 | ✅ | Genera ticket HTML para imprimir |
| Q6 | Eliminar quote | 🔴 | ✅ | Solo quotes pendientes |
| Q7 | Filtros | 🔴 | ✅ | Por estado y búsqueda de cliente |
| Q8 | Convertir a venta | 🟡 | ⏳ | Marcar como convertida |
| CF10 | Plantilla de ticket | 🟢 | Personalizar diseño del ticket |

---

## Módulo: Dashboard 🔴

| # | Feature | Prioridad | Descripción |
|---|---------|-----------|-------------|
| D1 | Resumen del día | 🔴 | Ventas hoy, tickets, promedio |
| D2 | Últimas ventas | 🔴 | Lista de las últimas 10-20 ventas |
| D3 | Alertas de stock bajo | 🔴 | Productos con stock mínimo |
| D4 | Productos más vendidos hoy | 🟡 | Top del día |
| D5 | Comparativa con ayer | 🟢 | Ventas hoy vs ayer |

---

## Conteo Total

| Prioridad | Cantidad |
|-----------|---------|
| 🔴 P0 (MVP) | ~30 features |
| 🟡 P1 | ~25 features |
| 🟢 P2 | ~5 features |
| **Total** | **~60 features** |
