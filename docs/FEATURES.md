# Features â€” TOG Admin

## Prioridades

- ðŸ”´ **P0** â€” MVP, indispensable para operar
- ðŸŸ¡ **P1** â€” Importante, agregar en fase 2
- ðŸŸ¢ **P2** â€” Deseable, agregar despuÃ©s
- ðŸ”µ **P3** â€” Futuro, expansiÃ³n del sistema

---

## MÃ³dulo: AutenticaciÃ³n ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| A1 | Login con usuario/contraseÃ±a | ðŸ”´ | âœ… | Pantalla de acceso con credenciales |
| A2 | SesiÃ³n con timeout | ðŸ”´ | âœ… | 30 min de inactividad auto-logout |
| A3 | Roles bÃ¡sico | ðŸ”´ | âœ… | Admin (acceso total) vs Cajero (solo POS + caja) |
| A4 | Cambio de contraseÃ±a | ðŸŸ¡ | âœ… | El usuario puede cambiar su propia contraseÃ±a |
| A5 | Rate limiting login | ðŸ”´ | âœ… | Bloqueo despuÃ©s de 5 intentos fallidos |
| A6 | Forzar cambio password | ðŸ”´ | âœ… | Admin debe cambiar password en primer login |

---

## MÃ³dulo: Punto de Venta (POS) ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| P1 | Carrito de compras | ðŸ”´ | âœ… | Agregar, modificar cantidad, eliminar items |
| P2 | BÃºsqueda de productos | ðŸ”´ | âœ… | Por cÃ³digo de barras, nombre, SKU |
| P3 | Precio unitario editable | ðŸ”´ | âœ… | Permite cambiar precio en venta directamente en el carrito |
| P4 | Descuento por item | ðŸ”´ | âœ… | Descuento individual por lÃ­nea (%) |
| P5 | Descuento global | ðŸ”´ | âœ… | Descuento sobre subtotal (%) |
| P6 | MÃºltiples mÃ©todos de pago | ðŸ”´ | âœ… | Efectivo, transferencia, pago mÃ³vil, mixto, tarjeta (configurable) |
| P7 | CÃ¡lculo de cambio | ðŸ”´ | âœ… | Auto-calcula vuelto en efectivo |
| P8 | Ticket impreso | ðŸ”´ | âœ… | Preview del ticket + impresiÃ³n |
| P9 | Ticket sin imprimir | ðŸ”´ | âœ… | Cerrar modal sin imprimir |
| P10 | Venta rÃ¡pida sin producto | ðŸ”´ | âœ… | BotÃ³n "Venta RÃ¡pida" para servicios por cobrar sin crear producto |
| P11 | Modo touch | ðŸŸ¡ | â³ | Botones grandes para pantalla tÃ¡ctil |
| P12 | Atajos de teclado | ðŸŸ¡ | âœ… | F2=buscar, F5=cobrar |
| P13 | Venta a crÃ©dito/fiado | ðŸŸ¡ | âœ… | Registrar venta sin cobro inmediato (mÃ©todo Fiado + secciÃ³n CrÃ©ditos) |
| P14 | Tarjeta (VP800) | ðŸŸ¡ | âœ… | IntegraciÃ³n con terminal Valor VP800 (USB/COM) |
| P15 | Componente CartItem | ðŸŸ¢ | âœ… | Subcomponente extraÃ­do para reutilizaciÃ³n |
| P16 | POS bloqueado sin caja | ðŸ”´ | âœ… | No funciona si no hay caja abierta |
| P17 | **EscÃ¡ner cÃ³digo de barras USB** | ðŸŸ¡ | âœ… | Hook useBarcodeScanner, scan â†’ buscar â†’ agregar al carrito |
| P18 | **EscÃ¡ner en creaciÃ³n de producto** | ðŸŸ¡ | âœ… | Escanear cÃ³digo al crear producto, auto-fill campo cÃ³digo barras |
| P19 | **EscÃ¡ner en compras** | ðŸŸ¡ | âœ… | Escanear cÃ³digo para agregar producto a la compra |

---

## MÃ³dulo: Productos / Inventario ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| I1 | CRUD de productos | ðŸ”´ | âœ… | Crear, leer, actualizar, eliminar productos |
| I2 | CÃ³digo de barras | ðŸ”´ | âœ… | Asignar y buscar por cÃ³digo de barras |
| I3 | CategorÃ­as | ðŸ”´ | âœ… | CRUD de categorÃ­as |
| I3b | Unidades de Medida | ðŸ”´ | âœ… | CRUD dinÃ¡mico + quick-add desde dropdown |
| I4 | Stock actual | ðŸ”´ | âœ… | Visualizar stock en tabla |
| I5 | Stock mÃ­nimo | ðŸ”´ | âœ… | Alerta cuando stock < mÃ­nimo |
| I6 | Importar productos | ðŸŸ¡ | âœ… | Cargar desde archivo CSV con validaciÃ³n |
| I7 | Exportar productos | ðŸŸ¡ | âœ… | Exportar inventario completo a CSV |
| I8 | Imprimir etiquetas | ðŸŸ¡ | â³ | Etiquetas con cÃ³digo de barras |
| I9 | Historial de movimientos | ðŸŸ¡ | âœ… | Registro de cada ajuste de stock con justificaciÃ³n |
| I10 | Ajuste de inventario | ðŸ”´ | âœ… | Corregir stock manualmente con justificaciÃ³n |
| I11 | Productos sin stock | ðŸŸ¡ | âœ… | Filtro "Stock Bajo" para ver productos por debajo del mÃ­nimo |
| I12 | **Tipo producto/servicio** | ðŸ”´ | âœ… | Columna `tipo` (producto|servicio); servicios sin control de stock (Fase 5) |
| I13 | **SubcategorÃ­as** | ðŸ”´ | âœ… | SubcategorÃ­as de productos por categorÃ­a (Fase 5) |
| I14 | **Marca del producto** | ðŸŸ¡ | âœ… | Campo opcional de marca (Fase 5) |
| I15 | **Imagen del producto** | ðŸŸ¡ | âœ… | Imagen en base64 (PNG/JPG/WebP, mÃ¡x 1MB) (Fase 5) |

---

## MÃ³dulo: Caja ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| C1 | Abrir caja | ðŸ”´ | âœ… | Registrar fondo inicial |
| C2 | Cerrar caja | ðŸ”´ | âœ… | ConciliaciÃ³n: esperado vs real |
| C3 | Resumen del dÃ­a | ðŸ”´ | âœ… | Total ventas, entradas, salidas, diferencia |
| C4 | Entradas manuales | ðŸ”´ | âœ… | Registrar dinero extra que entra a caja |
| C5 | Salidas / Retiros | ðŸ”´ | âœ… | Registrar retiros de efectivo |
| C6 | Solo una caja abierta | ðŸ”´ | âœ… | No permitir segunda apertura |
| C7 | Historial de cajas | ðŸ”´ | âœ… | Ver cajas cerradas anteriores |
| C8 | ImpresiÃ³n de cierre | ðŸŸ¡ | âœ… | Imprimir reporte de cierre de caja |
| C9 | Reporte X (parcial) | ðŸŸ¡ | âœ… | Ver total sin cerrar caja (ventas por mÃ©todo + movimientos) |

---

## MÃ³dulo: Ventas / Historial ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| V1 | Lista de ventas del dÃ­a | ðŸ”´ | âœ… | Todas las ventas con filtros |
| V2 | BÃºsqueda de venta | ðŸ”´ | âœ… | Por nÃºmero, cajero, mÃ©todo de pago |
| V3 | Detalle de venta | ðŸ”´ | âœ… | Ver items de cada venta |
| V4 | Anular venta | ðŸ”´ | âœ… | Cancelar y devolver stock (con motivo) |
| V5 | Re-imprimir ticket | ðŸ”´ | âœ… | Re-imprimir ticket de venta |
| V6 | Ventas por perÃ­odo | ðŸ”´ | âœ… | Filtrar por rango de fechas |
| V7 | MÃ©todos de pago | ðŸŸ¡ | âœ… | Filtrar ventas por mÃ©todo de pago |
| V8 | Resumen del filtro | ðŸŸ¡ | âœ… | Conteo y total del perÃ­odo filtrado |

---

## MÃ³dulo: Compras ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| CP1 | Registrar compras | ðŸ”´ | âœ… | Crear compra con items y actualizar stock |
| CP2 | Historial de compras | ðŸ”´ | âœ… | Lista de compras con filtros |
| CP3 | Proveedor asociado | ðŸ”´ | âœ… | Seleccionar proveedor al registrar compra |
| CP4 | EscÃ¡ner en compras | ðŸŸ¡ | âœ… | Escanear cÃ³digo de barras para agregar producto |

---

## MÃ³dulo: Proveedores ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| PR1 | CRUD de proveedores | ðŸ”´ | âœ… | Crear, editar, eliminar proveedores |
| PR2 | Datos de contacto | ðŸ”´ | âœ… | Nombre, EIN, telÃ©fono, email, direcciÃ³n |
| PR3 | Notas | ðŸŸ¢ | âœ… | Campo de notas para cada proveedor |

---

## MÃ³dulo: Distribuidor ðŸŸ¡ (adicional por licencia)

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| D1 | CRUD de clientes | ðŸ”´ | âœ… | Crear, editar, eliminar (borrado lÃ³gico); documento de registro internacional (RIF, RFC, EIN, CNPJâ€¦) |
| D2 | Listado y bÃºsqueda de clientes | ðŸ”´ | âœ… | Filtrar por nombre, documento o telÃ©fono |
| D3 | Crear pedido con lÃ­neas | ðŸ”´ | âœ… | CatÃ¡logo de productos del Core (no requiere permiso de inventario); precio autocompletado |
| D4 | NumeraciÃ³n secuencial de pedidos | ðŸ”´ | âœ… | `configuracion.pedido_numero`, idempotente |
| D5 | Estados de pedido | ðŸ”´ | âœ… | `pendiente` â†’ `despachado` â†’ `entregado`; anulaciÃ³n; validaciÃ³n de transiciones |
| D6 | Gating por licencia y permisos | ðŸ”´ | âœ… | MenÃº/rutas/handlers solo si el mÃ³dulo viene en la licencia y el usuario tiene permiso `distribuidor_*` |

---

## MÃ³dulo: Restaurant ðŸŸ¡ (adicional por licencia)

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| RST1 | CRUD de mesas | ðŸ”´ | âœ… | Mesas con capacidad y estado (libre/ocupada); seeds iniciales; borrado lÃ³gico |
| RST2 | Comanda por mesa | ðŸ”´ | âœ… | Abrir mesa, agregar productos del catÃ¡logo (precio autocompletado) o Ã­tems manuales, mover mesa |
| RST3 | Pantalla de cocina | ðŸ”´ | âœ… | Pedidos pendientes por comanda; marcar en preparaciÃ³n / listo / servido; comanda queda `servida` al servir todo |
| RST4 | Cobro de mesa | ðŸ”´ | âœ… | `comandas:checkout` factura solo Ã­tems servidos/listos reutilizando `createVenta` (stock, combos, fiado, caja); libera la mesa |
| RST5 | Gating por licencia y permisos | ðŸ”´ | âœ… | MenÃº/rutas/handlers solo con mÃ³dulo `restaurant` en la licencia + permisos `restaurant_*` |
| RST6 | Modo touch + atajos | ðŸŸ¡ | âœ… | Modo touch (botones grandes, persistido) + atajos F2 buscar / F5 cobrar / F9 cocina |
| RST7 | ImpresiÃ³n de comanda | ðŸŸ¡ | âœ… | Ticket tÃ©rmico de comanda al enviar a cocina + botÃ³n imprimir (misma convenciÃ³n de impresiÃ³n del Core) |
| RST8 | FusiÃ³n de mesas | ðŸŸ¡ | âœ… | `comandas:merge` junta los Ã­tems de dos mesas ocupadas en la comanda destino y libera la mesa origen |

---

## MÃ³dulo: Cotizaciones ðŸŸ¡

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| Q1 | Crear cotizaciÃ³n | ðŸŸ¡ | âœ… | Crear presupuesto con items, cliente, validez |
| Q2 | Lista de cotizaciones | ðŸŸ¡ | âœ… | Ver todas las cotizaciones con filtros |
| Q3 | Detalle de cotizaciÃ³n | ðŸŸ¡ | âœ… | Ver items y totales |
| Q4 | Editar cotizaciÃ³n | ðŸŸ¡ | âœ… | Modificar cotizaciÃ³n existente |
| Q5 | Eliminar cotizaciÃ³n | ðŸŸ¡ | âœ… | Eliminar cotizaciÃ³n |
| Q6 | Exportar cotizaciÃ³n a PDF | ðŸ”´ | âœ… | Plantilla A4 imprimible/guardable como PDF con encabezado de la empresa (misma convenciÃ³n print-to-PDF de Reportes) |
| Q7 | Convertir cotizaciÃ³n a venta | ðŸŸ¡ | âœ… | Modal de cobro (mÃ©todo de pago + monto) â†’ crea la venta real vÃ­a `ventas:create` y marca la cotizaciÃ³n como `convertida` |

---

## MÃ³dulo: Reportes ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| R1 | Ventas por perÃ­odo | ðŸ”´ | âœ… | Filtrar por rango de fechas |
| R2 | Productos mÃ¡s vendidos | ðŸ”´ | âœ… | Top productos por cantidad |
| R3 | Ãšltimas ventas | ðŸ”´ | âœ… | Ãšltimas 10 ventas en Dashboard |
| R4 | Exportar CSV | ðŸŸ¡ | âœ… | Exportar datos de reportes a CSV |
| R5 | Exportar PDF | ðŸŸ¡ | âœ… | Exportar reportes a PDF |
| R6 | GrÃ¡ficas de ventas | ðŸŸ¡ | âœ… | Recharts con grÃ¡ficas de tendencia |
| R7 | Reportes avanzados | ðŸŸ¡ | â³ | Comparativas, tendencias, exportaciÃ³n avanzada |

---

## MÃ³dulo: ConfiguraciÃ³n ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| CF1 | Datos del negocio | ðŸ”´ | âœ… | Nombre, direcciÃ³n, telÃ©fono, EIN, logo |
| CF2 | Impuestos | ðŸ”´ | âœ… | Configurar tasa de impuesto |
| CF3 | Impresora | ðŸŸ¡ | âœ… | Configurar nombre de impresora tÃ©rmica |
| CF4 | Fondo inicial default | ðŸŸ¡ | âœ… | Configurar fondo de caja por defecto |
| CF5 | Terminal VP800 | ðŸŸ¡ | âœ… | Configurar puerto COM, baud rate, conectar/desconectar |
| CF6 | Backup/Restore | ðŸ”´ | âœ… | Crear y restaurar copias de seguridad |
| CF7 | GestiÃ³n de usuarios | ðŸ”´ | âœ… | CRUD de usuarios con roles y permisos |
| CF8 | Tutorial | ðŸŸ¢ | âœ… | Onboarding de 5 pasos |
| CF9 | MÃ©todos de pago | ðŸŸ¡ | âœ… | Configurar mÃ©todos de pago (efectivo, tarjeta, etc.) |
| CF10 | **Tasa de cambio** | ðŸ”´ | âœ… | Campo `tasa_cambio` en Config â†’ Negocio (referencia, no altera precios) |
| CF11 | **MÃ³dulos de TOG Platform** | ðŸ”´ | âœ… | CatÃ¡logo de mÃ³dulos por licencia (estado, importar v2, **Sincronizar** desde el backend) |

---

## MÃ³dulo: Seguridad ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| SEC1 | Sistema de licencias RSA-2048 | ðŸ”´ | âœ… | Licencias offline con validaciÃ³n de firma + **Sincronizar** (canal pre-auth `license:sync`, re-validaciÃ³n RSA local) |
| SEC2 | Permisos por usuario (41 permisos) | ðŸŸ¡ | âœ… | 8 categorÃ­as de permisos granulares (incl. `distribuidor_*` y `creditos_*`) |
| SEC3 | Rate limiting en login | ðŸ”´ | âœ… | Bloqueo despuÃ©s de 5 intentos |
| SEC4 | Session timeout | ðŸ”´ | âœ… | 30 min de inactividad |
| SEC5 | Password hashing (bcrypt) | ðŸ”´ | âœ… | 10 salt rounds |
| SEC6 | ErrorBoundary + Crash Reports | ðŸŸ¡ | âœ… | Captura de errores + reportes automÃ¡ticos |
| SEC7 | CSP headers | ðŸŸ¢ | âœ… | CSP meta: estricta en producciÃ³n (sin inline scripts), relajada en dev vÃ­a `inject-csp` (Vite) |
| SEC8 | Validar origen IPC | ðŸŸ¢ | âœ… | Guard `handleIpc` (`core/auth/ipc-guard.ts`): solo main-frame + file:// o dev-server; todos los handlers pasan por Ã©l |

---

## MÃ³dulo: Infraestructura ðŸ”´

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| INF1 | Auto-update (electron-updater) | ðŸŸ¡ | âœ… | Actualizaciones vÃ­a GitHub Releases |
| INF2 | NSIS installer | ðŸŸ¡ | âœ… | Instalador Windows con acceso directo |
| INF3 | i18n (ES/EN) | ðŸŸ¡ | âœ… | ~1,382 keys por idioma (ES/EN, renderer) |
| INF4 | Tests automatizados | ðŸŸ¡ | âœ… | 204 tests (Vitest: validaciones, servicios, handlers IPC, componentes) |
| INF5 | Build portable | ðŸŸ¢ | âœ… | VersiÃ³n sin instalador |
| INF6 | Instalador X32 | ðŸŸ¡ | â³ | Instalador para arquitectura de 32 bits |
| INF7 | Logging estructurado (winston) | ðŸŸ¡ | â³ | Logging centralizado en main process |
| INF8 | Multi-plataforma (Mac/Linux) | ðŸŸ¢ | â³ | Soporte para macOS y Linux |

---

## MÃ³dulo: Futuro / ExpansiÃ³n ðŸ”µ

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| F1 | Combos de productos | ðŸ”´ | âœ… | Combos compuestos con rentabilidad real: componentes en el modal de producto, costo real + margen, stock por componentes al vender y desglose en el ticket (migraciÃ³n 023) |
| F2 | Multi-sucursal | ðŸŸ¡ | â³ | Varias ubicaciones con DB compartida (Fase 7) |
| F3 | Pantalla auxiliar | ðŸŸ¢ | â³ | Segunda pantalla para clientes (Fase 9) |
| F4 | FacturaciÃ³n fiscal Venezuela | ðŸ”´ | â³ | Comprobante fiscal vÃ¡lido (Fase 8) |
| F5 | CSV formato SENIAT | ðŸŸ¡ | â³ | Exportar para declaraciÃ³n de impuestos (Fase 8) |
| F6 | Modo touch | ðŸŸ¡ | â³ | Optimizado para tablet/pantalla tÃ¡ctil (Fase 3) |
| F7 | Venta a crÃ©dito/fiado | ðŸŸ¡ | âœ… | Cuentas por cobrar: deudores, abonos y saldos (Fase 3) |
| F8 | Imprimir etiquetas | ðŸŸ¡ | â³ | Etiquetas con cÃ³digo de barras (Fase 3) |
| F9 | WiFi para VP800 | ðŸŸ¡ | â³ | ComunicaciÃ³n WiFi vÃ­a Valor Connect (Fase 3) |
| F10 | Reportes modificables visuales | ðŸ”´ | âœ… | **Reportes Visuales** (`/reportes-visuales`): elegir fuente (ventas por dÃ­a, top productos, por categorÃ­a, Ãºltimas ventas), columnas visibles, perÃ­odo â†’ previsualizaciÃ³n + exportar CSV/PDF Â· guardar/cargar/eliminar reportes (migraciÃ³n 025) |
| F11 | Feedback desde el login | ðŸŸ¢ | âœ… | BotÃ³n en pantalla de login que envÃ­a feedback del cliente a un bot de Telegram del dueÃ±o (token configurable en ConfiguraciÃ³n â†’ Sistema) |
| F12 | Manager remoto | ðŸŸ¡ | âœ… | Rol **manager** (Gerente): ve/exporta reportes, agrega productos y modifica precios sin operar la caja; creable en ConfiguraciÃ³n â†’ Usuarios con permisos por defecto propios (sin POS/caja/configuraciÃ³n) |

---

## MÃ³dulo: Red Local (PC Base + PC hijas) ðŸŸ¡ (adicional por licencia `max_pcs â‰¥ 2`)

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| NET1 | Handshake de enlace con cÃ³digo de un solo uso | ðŸ”´ | âœ… | PC Base genera un cÃ³digo de 6 chars hex (TTL 5 min) desde Config â†’ Sistema â†’ Red Local. La hija lo transcribe y se enlaza con su IP y nombre |
| NET2 | Servidor HTTP local :3002 en la PC Base | ðŸ”´ | âœ… | `src/main/services/red-server.ts` levanta HTTP server en Node puro (cero deps). Endpoints: `POST /api/red/vincular`, `POST /api/red/rpc`, `POST /api/red/logout` |
| NET3 | ReenvÃ­o de IPC desde la PC Hija | ðŸ”´ | âœ… | `ipc-handlers.ts` en modo hija registra solo los canales locales (app:version, i18n, crash-report, update, red:*) y reenvÃ­a el resto vÃ­a HTTP a la Base (`red-client.ts`) |
| NET4 | SesiÃ³n Ãºnica por usuario en el grupo | ðŸ”´ | âœ… | `services/red-session.ts`: al hacer login se registra `sesiones_activas(usuario_id, par_id, sesion_token)`; si el mismo usuario ya estÃ¡ activo en otro `par_id`, el login se rechaza |
| NET5 | Tope de PCs por licencia | ðŸ”´ | âœ… | El campo `max_pcs` (1â€“20) de la licencia firmada define el mÃ¡ximo de `pcs_enlazadas` que la Base acepta. Tog-platform valida el rango y lo firma |
| NET6 | Setup screen para PC Hija | ðŸ”´ | âœ… | `SetupPage` (pantalla de bloqueo â†’ botÃ³n "Conectar a una PC Base"): pide IP, cÃ³digo y nombre. Se renderiza desde `LicenseGate` cuando la licencia no es vÃ¡lida localmente |
| NET7 | Permiso `red_manage` | ðŸŸ¡ | âœ… | Solo admin puede generar cÃ³digos y ver PCs enlazadas |
| NET8 | Logout distribuido | ðŸŸ¡ | âœ… | Al desloguear en la hija se llama `red:logout` (libera sesiones en la Base). Al cerrar la app (`before-quit`) se llama best-effort |
| NET9 | TLS local | ðŸŸ¢ | â³ | Pendiente: cert autofirmado generado al primer arranque de la Base |
| NET10 | Heartbeat 60s para expulsar sesiones huÃ©rfanas | ðŸŸ¢ | â³ | Pendiente: hoy la sesiÃ³n se libera al cerrar/desloguear la hija |

### MÃ³dulo: Producto ( imagen) y Moneda â€” extensiÃ³n del Core (Fase 5)

| # | Feature | Prioridad | Estado | DescripciÃ³n |
|---|---------|-----------|--------|-------------|
| IMG1 | Imagen de producto en filesystem | ðŸŸ¡ | âœ… | `services/imagenes.ts` valida magic bytes (JPG/PNG/WebP, â‰¤2MB), persiste en `%APPDATA%/tog-admin/imagenes/<id>.<ext>`. UI muestra thumbnail vÃ­a `ProductImage` + canal IPC `productos:get-imagen` (migraciÃ³n 030) |
| CUR1 | SÃ­mbolo + nombre de moneda + tasa de cambio | ðŸ”´ | âœ… | `configuracion: currency_symbol`, `currency_name`, `tasa_cambio`. `renderer/services/currency.ts` aplica la tasa a todos los importes. Form `Config â†’ Negocio` permite editar los tres (migraciÃ³n 029) |

---

## Resumen de Estado

| CategorÃ­a | Total | âœ… Completado | â³ Pendiente |
|-----------|-------|--------------|-------------|
| AutenticaciÃ³n | 6 | 6 | 0 |
| POS | 19 | 18 | 1 |
| Inventario | 16 | 15 | 1 |
| Caja | 9 | 9 | 0 |
| Ventas | 8 | 8 | 0 |
| Compras | 4 | 4 | 0 |
| Proveedores | 3 | 3 | 0 |
| Distribuidor | 6 | 6 | 0 |
| Restaurant | 8 | 8 | 0 |
| Cotizaciones | 7 | 7 | 0 |
| Reportes | 7 | 6 | 1 |
| ConfiguraciÃ³n | 11 | 11 | 0 |
| Seguridad | 8 | 8 | 0 |
| Infraestructura | 8 | 5 | 3 |
| Futuro/ExpansiÃ³n | 12 | 5 | 7 |
| Red Local (PC Base + hijas) | 10 | 8 | 2 |
| Producto (imagen) + Moneda | 2 | 2 | 0 |
| **TOTAL** | **144** | **131** | **13** |

**Porcentaje completado: 91.0%**

---

## Cambios recientes (5-Sep-2026)

Lote de 4 commits sobre la rama ix/license-modularization a partir de la revisión del cliente. No agregan features de catálogo grandes; son bugs, UX y la base para los próximos.

### Commit A — Bugs pequeños (985c96d)

- **Header / búsqueda global** — el input del header ahora es funcional (Ctrl+K). Busca en productos (incluye coincidencia exacta por código de barras → abre el POS), clientes y ventas por número.
- **MesasPage auto-refresh** — el listado de mesas se refresca cada 5s cuando no hay comanda abierta (antes había que cambiar a Cocina para ver los cambios).
- **Restaurant usa los métodos de pago del Core** — el modal de cobro de mesa ahora carga los métodos configurados en metodos_pago (no más hardcodeados). El handler metodos-pago:list con activoOnly se relaja a pos_access para que un cajero pueda listarlos sin permisos de admin.

### Commit B — POS / venta (7b2d7a)

- **Cliente opcional en POS para factura** — selector general arriba del carrito; se persiste en ventas.cliente_id (migración 026). Imprime los datos del cliente en el ticket.
- **Hold sale / Borradores** — nueva tabla ventas_borrador + handlers borradores:list/save/load/delete + UI en POS (botón "Guardar venta" y modal "Borradores"). El borrador se elimina automáticamente al cobrar.

### Commit C — Impresión (c159cae)

- **Imprimir remito** — remitos:getById con join de productos del pedido + botón Imprimir en la tabla; ticket con datos del cliente y firma.
- **Ticket al cobrar mesa** — el doCheckout de restaurant imprime el ticket de la venta creada vía ventas:getById (mismo patrón que el POS).
- **Nota de entrega como tipo de comprobante** — migración 027 agrega ventas.tipo_comprobante ('factura' default / 'nota_entrega'). Checkbox en el modal de cobro del POS cambia el encabezado del ticket.

### Commit D — Almacenes + Listas de precio (24a48de)

- **Almacenes (base + hooks)** — migración 028 crea almacenes y producto_almacen; seed automático del almacén "Principal"; página AlmacenesPage con CRUD y stock por producto. Listo para traspasos y kardex por almacén (preparado en DB, queda para fase futura).
- **Listas de precio mejoradas** — además del factor global, ahora cada lista puede tener productos con precio_override y clientes asignados vía cliente_lista_precio. UI con tabs Listas / Productos / Clientes.

### Commit E — Fase 5 + Interconexión por red local (5-Sep-2026)

Spike funcional completo de la **interconexión PC Base + PC hijas** + las features de la **Fase 5 (Productos / Servicios / Imagen / Moneda)**, fusionado a master tras la revisión del cliente. Detalle completo en `docs/ARCHITECTURE.md` (sección "Módulo Red Local") y `docs/MODULOS.md`.

- **Red local** (migración 031): tablas `pcs_enlazadas`, `sesiones_activas`, `codigos_enlace`; `services/red-{config,server,client,session}.ts`; `modules/red/handlers.ts`; UI en `Config → Sistema → Red Local` (generar código, listar PCs, desvincular); `SetupPage` para PC Hija.
- **Sesión única** por usuario en el grupo (`red-session.ts`); el `auth:login` recibe `__par_id` por RPC para registrar en la Base.
- **`max_pcs` en licencias**: `signLicense` valida 1–20; `tog-platform` lo acepta en emisión manual.
- **Imagen de producto en filesystem** (migración 030): `services/imagenes.ts` valida magic bytes JPG/PNG/WebP ≤2MB; canales `productos:set-imagen|get-imagen|delete-imagen`; UI `ProductImage`.
- **Moneda, símbolo y tasa de cambio** (migración 029): `configuracion: currency_name`; `renderer/services/currency.ts` aplica símbolo + tasa a toda la app.
- **Logger centralizado**: `services/logger.ts` (electron-log con degradación a `console` en CLI).
- **Validación de origen IPC** endurecida: `handleIpc` (`core/auth/ipc-guard.ts`) rechaza cualquier sender que no sea main-frame `file://` o `localhost:5173`; la misma tabla de handlers se usa como dispatcher para `red-client.ts` cuando una Hija reenvía un RPC.

### Pendiente

- ⏳ **Exportar cotización a PDF nativo** (Fase 6 — hoy se imprime a ventana).
- ⏳ **Facturación fiscal Venezuela** (Fase 8 — depende de normativa SNAT).
- ⏳ **Heartbeat automático (60s)** para expulsar sesiones huérfanas en la red local; hoy se libera al cerrar/desloguear la hija.
- ⏳ **TLS local** con cert autofirmado generado al primer arranque de la PC Base (spike funcional actual: HTTP plano en LAN con credenciales de par).