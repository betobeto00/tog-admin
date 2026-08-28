# Features — TOG Admin

## Prioridades

- 🔴 **P0** — MVP, indispensable para operar
- 🟡 **P1** — Importante, agregar en fase 2
- 🟢 **P2** — Deseable, agregar después

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
| P6 | Múltiples métodos de pago | 🔴 | ✅ | Efectivo, transferencia, pago móvil, mixto, tarjeta |
| P7 | Cálculo de cambio | 🔴 | ✅ | Auto-calcula vuelto en efectivo |
| P8 | Ticket impreso | 🔴 | ✅ | Preview del ticket + impresión |
| P9 | Ticket sin imprimir | 🔴 | ✅ | Cerrar modal sin imprimir |
| P10 | Venta rápida sin producto | 🔴 | ✅ | Botón "Venta Rápida" para servicios por cobrar sin crear producto |
| P11 | Modo touch | 🟡 | ⏳ | Botones grandes para pantalla táctil |
| P12 | Atajos de teclado | 🟡 | ✅ | F2=buscar, F5=cobrar |
| P13 | Venta a crédito/fiado | 🟡 | ⏳ | Registrar venta sin cobro inmediato |
| P14 | Tarjeta (VP800) | 🟡 | ✅ | Integración con terminal Valor VP800 |
| P15 | Componente CartItem | 🟢 | ✅ | Subcomponente extraído para reutilización |
| P16 | POS bloqueado sin caja | 🔴 | ✅ | No funciona si no hay caja abierta |

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
| R7 | Ventas por categoría | 🟡 | ✅ | Gráfico de barras horizontales por categoría |
| R8 | Margen de ganancia | 🟡 | ⏳ | Ganancia real vs esperada |
| R9 | Exportar reportes | 🟡 | ✅ | Exportar CSV + Imprimir PDF desde Reportes |
| R10 | Últimas ventas (Dashboard) | 🔴 | ✅ | Últimas 10 ventas en dashboard |

---

## Módulo: Configuración 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| CF1 | Datos del negocio | 🔴 | ✅ | Business name, EIN, address, phone |
| CF2 | Gestión de usuarios | 🔴 | ✅ | CRUD users, roles admin/cashier |
| CF3 | Sales Tax | 🔴 | ✅ | Configurable rate by state (default 0%) |
| CF4 | Moneda | 🔴 | ✅ | Currency symbol (default $ USD) |
| CF5 | Parámetros de caja | 🟡 | ✅ | Fondo inicial default configurable en Config |
| CF6 | Backup manual | 🔴 | ✅ | Crear copia de seguridad (.db) |
| CF7 | Backup automático | 🟡 | ✅ | Backup automático antes de cerrar caja |
| CF8 | Restaurar backup | 🔴 | ✅ | Cargar archivo .db de respaldo |
| CF9 | Configurar impresora | 🟡 | ✅ | Campo de nombre de impresora en Config |
| CF10 | Configurar terminal VP800 | 🔴 | ✅ | Puerto COM, baud rate, conectar/desconectar |
| CF11 | Reiniciar tutorial | 🟡 | ✅ | Botón para mostrar onboarding a nuevos usuarios |

---

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

---

## Módulo: Empaquetado / Distribución 🟡

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| E1 | Instalador NSIS | 🔴 | ✅ | Genera TOG-Admin-Setup.exe con acceso directo |
| E2 | Desinstalador | 🔴 | ✅ | Se desinstala desde Panel de Control |
| E3 | Idioma español | 🟡 | ✅ | Instalador en español |
| E4 | Matar procesos | 🟡 | ✅ | Cierra TOG Admin antes de instalar/desinstalar |

---

## Módulo: Dashboard 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| D1 | Resumen del día | 🔴 | ✅ | Ventas hoy, tickets, promedio |
| D2 | Últimas ventas | 🔴 | ✅ | Tabla de últimas 10 ventas |
| D3 | Alertas de stock bajo | 🔴 | ✅ | Productos con stock mínimo |
| D4 | Productos más vendidos hoy | 🟡 | ⏳ | Top del día |
| D5 | Comparativa con ayer | 🟢 | ⏳ | Ventas hoy vs ayer |

---

## Módulo: Seguridad 🔴

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| S1 | Validación Zod en IPC | 🔴 | ✅ | 19 schemas de validación en handlers críticos |
| S2 | Validación de stock | 🔴 | ✅ | Prevenir stock negativo en ventas |
| S3 | Notificaciones toast | 🔴 | ✅ | Sistema de feedback al usuario |
| S4 | Context isolation | 🔴 | ✅ | Electron IPC seguro |
| S5 | Bcrypt hashing | 🔴 | ✅ | Contraseñas hasheadas con salt |
| S6 | Sistema de licencias | 🔴 | ✅ | RSA-2048 con validación offline |
| S7 | ErrorBoundary global | 🔴 | ✅ | Captura errores React con UI amigable |

---

## Módulo: Ayuda / Onboarding 🟡

| # | Feature | Prioridad | Estado | Descripción |
|---|---------|-----------|--------|-------------|
| H1 | Centro de Ayuda | 🟡 | ✅ | 12 secciones detalladas con búsqueda |
| H2 | Tutorial de onboarding | 🟡 | ✅ | 5 pasos interactivos para nuevos usuarios |
| H3 | Notificaciones | 🟡 | ✅ | Campana con alertas de stock bajo y caja |
| H4 | Copyright / Licencias | 🟡 | ✅ | Botones legales en pantalla de login |
| H5 | Privacidad / Términos | 🟡 | ✅ | Políticas en modales del login |

---

## Conteo Total

| Prioridad | Implementadas | Pendientes |
|-----------|---------------|------------|
| 🔴 P0 (MVP) | ~45 | ~0 |
| 🟡 P1 | ~31 | ~3 |
| 🟢 P2 | ~4 | ~2 |
| **Total** | **~80** | **~5** |
