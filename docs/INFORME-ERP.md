Reporte Arquitectónico Completo — TOG Admin (v1.0.8)
Proyecto: TOG Admin — Sistema de Punto de Venta para Papelería, Centro de Copiado e Impresión
Versión analizada: 1.0.8 (lectura estática del código en C:\Users\DeadW\dev\D-E)
Tipo de app: Desktop monolítica single-PC con Electron
Stack verificado: Electron31 + React 18 + TypeScript5.4 + SQLite (better-sqlite3) + Vite5
1) Stack técnico
Capa	Tecnología	Evidencia
Shell / runtime desktop	Electron 31	package.json:56 ("electron": "^31.0.0")
UI frontend	React 18 + TypeScript	package.json:33-34,51-52
Estilos	Tailwind CSS 3.4 + clsx + tailwind-merge	package.json:60,6, 40
Estado global	Zustand 4.5 (sólo para auth)	package.json:42; usado en src/renderer/stores/auth.store.ts
Routing	react-router-dom 6.23 (HashRouter)	package.json:37; src/renderer/App.tsx:54
Formularios	react-hook-form + zod resolver	package.json:23, 35 (declarados, uso real limitado)
Validación	Zod 3.23	package.json:41; esquemas en src/shared/validations.ts
i18n	i18next + react-i18next (ES/EN)	package.json:30-31, 36
Persistencia	SQLite con better-sqlite3 11	package.json:25; src/main/db/database.ts:1
Terminal de pago	serialport 13 (VP800, USB COM virtual)	package.json:39; src/main/services/valorTerminal.ts:35
Gráficos	recharts	package.json:38; ReportesPage.tsx:3-6
Hash de passwords	bcryptjs	package.json:24; ipc-handlers.ts:2
Build main process	TypeScript 5.4 (tsc -p tsconfig.main.json)	package.json:11, 62
Build renderer	Vite 5.2	package.json:63; vite.config.ts
Empaquetado	electron-builder 24.13 + NSIS	package.json:57, 88-103
Auto-update	electron-updater 6.8 + electron-log	package.json:28-29; src/main/services/updater.ts:1
Testing	Vitest 4 + React Testing Library + jsdom	package.json:46-47, 58, 64
Util UI	lucide-react	package.json:32 (iconos)
Util fechas	date-fns	package.json:27 (declarado, uso real no encontrado en código)
Observación: react-hook-form, date-fns y @hookform/resolvers aparecen en package.json pero no se observa uso real en los archivos del repositorio (deuda menor / dependencias no utilizadas).
2) Estructura de carpetas y módulos
D-E/
├── docs/                  (18 archivos: ARCHITECTURE, ROADMAP, DATA_MODEL, Caso-Venezuela, etc.)
├── packaging/             (NSIS installer.nsh)
├── public/                (logo.jpg, hero-bg.jpg, favicons)
├── resources/             (icon.ico, icon.png)
├── scripts/               (inline-css.js, update-help-translations.py)
├── src/
│   ├── main/              (Node.js — Electron main process)
│   │   ├── index.ts                  (Entry point, BrowserWindow, tray, lifecycle)
│   │   ├── preload.ts                (contextBridge → window.api tipada)
│   │   ├── ipc-handlers.ts           (40+ canales IPC, monolito 1578 líneas)
│   │   ├── db/database.ts            (SQLite + 14 migraciones + seeds)
│   │   ├── db/migrate.ts             (CLI para correr migraciones)
│   │   ├── i18n/ (i18n del main process, locales ES/EN)
│   │   └── services/                 (lógica de dominio "backend")
│   │       ├── valorTerminal.ts       (Integración VP800 — hardcoded)
│   │       ├── license.ts            (RSA-2048 + anti-tampering)
│   │       ├── permissions.ts        (back de permisos — NO USADO en handlers)
│   │       ├── configCache.ts        (Cache singleton en memoria)
│   │       ├── crash-reporter.ts     (Reportes de error a archivo)
│   │       └── updater.ts            (Auto-update via GitHub Releases)
│   ├── renderer/          (React — UI)
│   │   ├── App.tsx                   (HashRouter + ProtectedRoute + LicenseGate)
│   │   ├── main.tsx                  (Bootstrap React)
│   │   ├── pages/                    (12 páginas = áreas funcionales)
│   │   ├── components/
│   │   │   ├── layout/               (Layout, Sidebar, Header)
│   │   │   ├── pos/                  (CartItem)
│   │   │   ├── ui/                   (Modal, ConfirmDialog, Toast, PermissionsModal)
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ForcePasswordChange.tsx
│   │   │   ├── LicenseGate.tsx (Gate que bloquea la app sin licencia)
│   │   │   └── Tutorial.tsx
│   │   ├── stores/auth.store.ts      (Zustand — sesión + timeout 30min)
│   │   ├── hooks/                    (useBarcodeScanner, usePermissions)
│   │   ├── lib/utils.ts              (cn, formatCurrency, formatDate, formatTicketNumber)
│   │   └── i18n/locales/{es,en}/translation.json  (630+ keys)
│   └── shared/            (compartido entre main y renderer)
│       ├── types.ts                  (Interfaces TS de dominio)
│       ├── validations.ts            (Schemas Zod)
│       └── permissions.ts            (Catálogo de 28 permisos en 7 categorías)
└── build.bat, package.json, vite.config.ts, tailwind.config.ts, tsconfig*.json
Áreas funcionales (páginas + IPC handlers principales)
Área	Página	Handlers IPC	Propósito (1 línea)
Auth / Licencia	LoginPage.tsx	auth:login, license:*	Autenticación con bcrypt + rate-limit + gate de licencia RSA.
Dashboard	DashboardPage.tsx	ventas:resumen-dia, productos:low-stock, reportes:ultimas-ventas	Resumen del día: ventas, stock bajo, últimas ventas.
POS / Ventas	POSPage.tsx (742 líneas)	ventas:*	Punto de venta: carrito, búsqueda, scanner, descuentos, múltiples métodos de pago, ticket.
Caja	CajaPage.tsx (526 líneas)	caja:*	Apertura/cierre de caja con fondo inicial, movimientos, reporte X, backup automático.
Inventario	InventarioPage.tsx (815 líneas)	productos:*, categorias:*, unidades:*	CRUD de productos, importación/exportación CSV, ajustes de stock con justificación.
Ventas (historial)	VentasPage.tsx	ventas:list/getById/anular	Listado, detalle, anulación con devolución de stock.
Compras	ComprasPage.tsx	compras:*, proveedores:*	Registro de compras a proveedor con actualización automática de stock.
Proveedores	ProveedoresPage.tsx	proveedores:*	CRUD de proveedores con EIN/RIF, teléfono, email, dirección.
Cotizaciones	QuotesPage.tsx (439 líneas)	quotes:*	Crear, aprobar/rechazar, convertir cotizaciones con cliente.
Reportes	ReportesPage.tsx	reportes:*	Gráficos con recharts: ventas por período, top productos, métodos de pago, por categoría.
Configuración	ConfigPage.tsx (1110 líneas)	config:*, usuarios:*, terminal:*, backup:*, metodos-pago:*	Negocio, usuarios, métodos de pago, terminal VP800, backup/restore, reset DB, licencia.
Centro de Ayuda	HelpPage.tsx	—	Documentación interna con búsqueda (12 secciones).
3) Núcleo del negocio
###3.1 ¿CRUD genérico reutilizable o dominio hardcodeado?
Veredicto: NO es un CRUD genérico. Es un POS con lógica de dominio específica del sector retail de mostrador, con personalización para papelería/copiado pero sin acoplamiento fuerte a "papelería" en sí.
3.2 Dónde está la lógica de dominio
Capa	Archivo:línea	Tipo de lógica
Esquema de datos	src/main/db/database.ts:104-389	14 migraciones SQL hardcoded: usuarios, productos, ventas, caja, compras, cotizaciones, ajustes, métodos de pago, configuración. El modelo es POS genérico de mostrador, no papelería.
Reglas de stock	src/main/ipc-handlers.ts:632-641	Validación de stock antes de venta: if (producto.unidad !== 'servicio' && producto.stock < det.cantidad) return error.
Descuento de stock en venta	src/main/ipc-handlers.ts:680-686	En transacción: inserta detalles + UPDATE productos SET stock = stock - ?.
Aumento de stock en compra	src/main/ipc-handlers.ts:833-836	UPDATE productos SET stock = stock + ?.
Devolución de stock en anulación	src/main/ipc-handlers.ts:725-731	Recorre detalles, devuelve cantidad al stock.
Número de venta secuencial diario	src/main/ipc-handlers.ts:644-649	SELECT MAX(numero_venta) WHERE DATE(fecha)=hoy + 1.
Caja única abierta	src/main/ipc-handlers.ts:866-868	Verifica que no haya caja abierta antes de abrir nueva.
Cálculo de total esperado al cerrar caja	src/main/ipc-handlers.ts:885-886	fondo_inicial + total_entradas - total_salidas + total_ventas.
Cálculo de impuestos en POS	src/renderer/pages/POSPage.tsx:155-174	subtotalConGlobal * (sales_tax_rate/100) — tasa leída de config.
Tipo "servicio"	src/main/ipc-handlers.ts:638	Si unidad === 'servicio' no descuenta stock (workaround hasta Fase5 cuando separe tipo).
Categorías seedadas (vacías)	src/main/db/database.ts:424-425	Comentario: "categorías NO se seedean — el cliente crea las suyas". Esto demuestra que es genérico: el dominio no impone papelería.
Unidades de medida seedadas	src/main/db/database.ts:428-440	Unidad, Paquete, Caja, Resma, Rollo, Litro, Galón, Hoja, Metro, Par, Servicio. La palabra "Resma" y "Hoja" apuntan al sector papelería/copiado como sesgo leve en seeds.
Métodos de pago seedados	src/main/db/database.ts:384-386	efectivo y tarjeta (VP800) por defecto — VP800 es integración regional hardcoded.
Resumen del día por método	src/main/ipc-handlers.ts:749-758	SUM(CASE WHEN metodo_pago='efectivo' THEN total ELSE 0 END) — métodos codificados.
Lógica de licencia con anti-tampering	src/main/services/license.ts:190-215	Detecta si el reloj del sistema retrocedió.
Búsqueda por código de barras	src/main/ipc-handlers.ts:510-534	Buscar primero por codigo_barras exacto, fallback por sku.
3.3 Señales de "no es CRUD genérico"
- Tiene flujos con estado: caja (abierta/cerrada) → venta → movimiento de caja → cierre con conciliación.
- Reglas de stock dentro de transacciones DB (db.transaction(...)).
- Numeración secuencial por día (no global), propia del flujo POS.
- VP800 hardcoded como método de pago (terminal regional venezolano).
- Categorías por defecto NO se siembran, pero las unidades y el campo ein (EIN/RIF tributario) sugieren orientación a EEUU/Venezuela.
3.4 Entidades de dominio (en src/shared/types.ts)
Usuario · Categoria · Producto · Proveedor · Venta · VentaDetalleCompra · CompraDetalle · Caja · MovimientoCaja · Configuracion
MetodoPago · (más tipos en pages/*.tsx: CajaState, CompraRecord, Quote, etc.)
Hay dos definiciones paralelas de tipos: la "oficial" en src/shared/types.ts y las "locales" repetidas en cada página (POSPage.tsx:15-34, CajaPage.tsx:11-23, etc.). Esto es deuda técnica: cada página re-declara interfaces, lo que provocaría drift.
4) Puntos de acoplamiento y obstáculos para modularizar
4.1 Singletons / estado global
Singleton	Archivo:línea	Riesgo de acoplamiento
db (SQLite)	src/main/db/database.ts:6 let db: Database.Database | null = null	CRÍTICO — singleton de proceso. Toda la app asume una sola DB local en %APPDATA%. Migrar a otra DB o módulo multi-DB requiere refactor.
configCache	src/main/services/configCache.ts:3 let configCache: Map<string, string> | null = null	Cache en memoria mutable, invalidado manualmente.
terminalInstance	src/main/services/valorTerminal.ts:163 let terminalInstance: ValorTerminalService | null	Una sola conexión serial por proceso.
loginAttempts	src/main/ipc-handlers.ts:154 Map<string, { count; lastAttempt }>	Rate limit en memoria (se pierde al reiniciar).
sessionTimer + useAuthStore	src/renderer/stores/auth.store.ts:96-117	Estado de sesión global del renderer.
mainWindow / tray	src/main/index.ts:9-10	Refs mutables globales.
logBuffer	src/main/services/crash-reporter.ts:60	Buffer circular de logs en memoria.
loginAttempts	src/main/ipc-handlers.ts:154	Mismo punto: rate-limit en memoria, no persistente.
4.2 Acoplamiento fuerte a Electron
- Toda la capa de persistencia es better-sqlite3 (módulo nativo). Requiere electron-rebuild (src/main/services/valorTerminal.ts:39-41). Migrar a Postgres o un ORM exigiría reescribir database.ts, migrate.ts, todos los IPC handlers (≈6000 líneas), todos los seeds, todas las queries inline en handlers, y eliminar el cache configCache.ts.
- Las rutas del sistema de archivos son absolute-path-coupled a Electron: app.getPath('userData') en8+ archivos (database.ts:14, license.ts:46-50, crash-reporter.ts:36, etc.). Imposible usar el código sin Electron.
- preload.ts expone un god-object window.api con 80+ métodos (src/main/preload.ts:4-196). Es un facade monolítico, no una superficie modular.
4.3 Acoplamiento de la lógica de negocio a la capa IPC
- Lógica de dominio mezclada con transporte IPC: el handler ventas:create (ipc-handlers.ts:624-714) hace validación Zod + validación de stock + transacción + cálculo de número de venta + actualización de movimientos de caja + invalidación de cache. ≈90 líneas en una sola función. No hay "SaleService" separado.
- Las queries SQL están inline en cada handler: db.prepare('SELECT...'). No hay repositorios ni capa de datos.
- No hay capa de servicios de dominio: solo valorTerminal.ts (es un adapter de hardware). La lógica de ventas, compras, caja vive directamente en los handlers.
4.4 Dependencias circulares / acoplamiento cruzado
- ipc-handlers.ts importa services/permissions.ts, pero requirePermission/checkPermission no se invocan en ningún handler (verificado por grep — sólo se importa checkPermission en línea 27). Los permisos se aplican únicamente en el renderer (Sidebar.tsx, ConfigPage.tsx, etc.). Esto es un agujero de seguridad real: cualquier cliente IPC puede saltarse los permisos.
- ipc-handlers.ts lee getDbPath() redeclarado en línea 1102 (no usa el de database.ts:13) — duplicación de código.
- auth.store.ts modifica localStorage globalmente (auth.store.ts:90) y crea un side effect a nivel de módulo. No es testeable aisladamente.
4.5 Acoplamiento al modelo de datos
- Las migraciones viven en código fuente hardcoded (database.ts:104-389). No hay herramienta CLI de migración con timestamp; los nombres son 001_usuarios, 002_categorias... Cambiar el orden requiere cuidado.
- Borrado lógico via activo en todas las entidades (usuarios, categorias, productos, proveedores, unidades_medida). Conveniente pero implica que toda query debe filtrar WHERE activo = 1.
- No hay FK constraints en el código que las active explícitamente (las REFERENCES están en SQL pero el handler no las usa con cascade).
4.6 Resumen de obstáculos para extracción
Obstáculo	Severidad	Esfuerzo de refactor
Singleton db + queries inline en handlers	🔴 Alta	Reescribir 6000 líneas detrás de una interfaz IRepository<T>
ipc-handlers.ts monolítico (1578 líneas)	🔴 Alta	Dividir por dominio en archivos por entidad
God-object window.api en preload	🟡 Media	Una fachada por dominio (window.posApi, window.inventoryApi)
Tipos duplicados entre shared/types.ts y pages	🟡 Media	Mover todos los tipos a shared/
permissions.ts en backend no usado	🟡 Media	Conectar handlers a requirePermission (15 min de cambio)
Acoplamiento a Electron (app.getPath)	🔴 Alta	Abstracción IStoragePaths + DI
better-sqlite3 nativo	🔴 Alta	Reemplazar por ORM (Drizzle/Prisma) o driver Postgres
Sesión de Electron-only (LicenseGate hardcoded, crash reporter con os)	🟡 Media	Envolver en adaptadores
5) Modelo de datos
5.1 Tablas y migraciones (src/main/db/database.ts:104-389)
#	Migración	Tabla	Propósito
001	usuarios	usuarios	Login + rol + bcrypt
002	categorias	categorias	Agrupación de productos
003	productos	productos +3 idx	SKU, código barras, precios, stock, unidad
004	proveedores	proveedores	EIN/RIF, contacto
005	ventas	ventas, venta_detalles + 4 idx	Cabecera + items
006	compras	compras, compra_detalles + 2 idx	Cabecera + items
007	caja	caja, movimientos_caja + 2 idx	Sesión de caja + entradas/salidas
008	configuracion	configuracion	K/V (clave, valor, descripcion)
009	unidades_medida	unidades_medida	ud, paq, cj, res, rl, L, gal, hj, m, par, svc
010	quotes	quotes, quote_detalles + 3 idx	Cotizaciones
011	alter usuarios	+debe_cambiar_contrasena	Forzar cambio primer login
012	ajustes_inventario	ajustes_inventario + 2 idx	Auditoría de correcciones
013	alter usuarios	+permisos (TEXT, JSON)	Permisos granulares
014	metodos_pago	metodos_pago	Efectivo / Tarjeta / etc. configurables
Total: 16 tablas + 22 índices (verificado en database.ts:154-156, 206-209, 239-240, 273-274, 334-336, 359-360).
5.2 Diagrama de relaciones (resumido)
usuarios ──┬── ventas ── venta_detalles ── productos ── categorias ├── compras ── compra_detalles ──┘ └── unidades_medida
            ├── caja ── movimientos_caja            └── metodos_pago
            └── (permisos JSON por usuario)
proveedores ── compras (FK opcional)
configuracion (K/V global)
quotes ── quote_detalles ── productos (FK opcional, permite items sin producto)
ajustes_inventario ── productos + usuarios
5.3 Características del modelo
- PKs siempre INTEGER PRIMARY KEY AUTOINCREMENT (surrogate keys).
- Timestamps TEXT con datetime('now') — SQLite-style, no zonas horarias explícitas.
- Precios y montos como REAL — riesgo de precisión decimal. Aceptable para el dominio mostrador.
- Stock como INTEGER (line: 145), pero venta_detalles.cantidad y compra_detalles.cantidad como REAL (líneas 199, 234) — inconsistencia que podría permitir ventas fraccionarias en transacciones masivas.
- No hay timestamps updated_at en todas las tablas (ventas, compras, movimientos_caja, etc.).
- No hay soft-delete en ventas, compras, caja, quotes — solo activo en usuarios, categorías, productos, proveedores, unidades.
- Relación quotes.producto_id es NULLABLE (línea 326) — permite cotizar servicios genéricos.
5.4 Lo que NO está modelado (y un ERP necesitaría)
- No hay clientes (las ventas son anónimas; las cotizaciones guardan cliente_nombre como texto, sin tabla).
- No hay lotes / series / vencimientos.
- No hay múltiples sucursales / almacenes / ubicaciones de stock.
- No hay tabla de impuestos (el IVA se calcula como % plano sobre el subtotal).
- No hay cuentas por cobrar / créditos (mencionado en ROADMAP Fase 3 como pendiente).
- No hay tabla de cierre de período fiscal / ejercicio.
- No hay audit log de cambios (solo creado_en y actualizado_en).
6) Integración externa y extensibilidad
6.1 Integraciones externas reales
Integración	Archivo:línea	Protocolo / Mecanismo	Acoplamiento
Terminal de pago Valor VP800	src/main/services/valorTerminal.ts:90-149	Serial (USB COM virtual), tramas JSON envueltas entre STX/ETX	Muy alto — clase ValorTerminalService dedicada, importada dinámicamente en metodos-pago:procesar-tarjeta (ipc-handlers.ts:1179). No hay adapter/interface; cambiar de terminal exige reescribir este archivo.
GitHub Releases (auto-update)	src/main/services/updater.ts:1-138	electron-updater + electron-log	Medio — provider fijo en package.json:104-108. Cambiar de proveedor exige reconfig.
bcrypt (hash local)	ipc-handlers.ts:2	Node crypto + bcryptjs	Bajo — puro Node.
RSA-2048 (licencia)	src/main/services/license.ts:34-42	Node crypto con clave pública embebida	Bajo — algoritmo estándar, pero la clave pública está hardcoded en el código (línea 34).
NSIS installer (Windows)	packaging/installer.nsh	NSIS macros	Bajo — sólo afecta al instalador.
6.2 Mecanismos de extensibilidad
Mecanismo	¿Existe?	Evidencia
Plugins	❌ No	No hay sistema de plugins ni hot-load de módulos.
Hooks / Event Bus	❌ No	No hay dispatcher de eventos de dominio (ej. "onVentaCreated"). La única cadena es la transacción SQL en ventas:create.
API REST/GraphQL	❌ No	Toda la comunicación es IPC local.
Webhooks externos	❌ No	—
Configuración runtime	✅ Parcial	Tabla configuracion (K/V) + metodos_pago configurable.
Permisos granulares	✅ Sí	src/shared/permissions.ts con 28 permisos en 7 categorías, asignables por usuario.
i18n	✅ Sí	ES/EN con 630+ keys en renderer/i18n/locales/.
CSV import/export	✅ Sí	Productos (productos:export-csv, productos:import-csv) — handlers en ipc-handlers.ts:1405-1486.
Reporte a PDF	⏳ Pendiente	Roadmap Fase 6, no implementado.
6.3 Cómo se "extiende" hoy
- Nuevas entidades = nueva migración SQL (getMigrations() array en database.ts) + nuevos handlers IPC en ipc-handlers.ts + nueva página + nueva entrada en preload.ts + nueva entrada en App.tsx router.
- No hay scaffolding automatizado.
- El Sidebar está hardcoded (Sidebar.tsx:25-37); los items de menú son un array literal.
- El auth store tiene un solo store (auth.store.ts); no hay stores por dominio.
7) Calidad para modularizar
7.1 Tests| Tipo | Cantidad | Cobertura |
|------|----------|-----------|
| Unit tests (Zod schemas) | src/shared/validations.test.ts | ✅ 28 tests |
| Unit tests (Permissions) | src/shared/permissions.test.ts | ✅ 24 tests |
| Unit tests (utils) | src/renderer/lib/utils.test.ts | ✅ 15 tests |
| Component tests | ErrorBoundary.test.tsx, ForcePasswordChange.test.tsx, Tutorial.test.tsx, PermissionsModal.test.tsx | ✅ 40 tests |
| Total | ~134 tests | Solo capa shared/ y componentes UI. |
| Tests del main process | ❌ 0 | No hay tests de ipc-handlers.ts, database.ts, ni servicios. |
| Tests de integración | ❌ No | No hay flujos end-to-end. |
| Tests del flujo de ventas | ❌ No | La lógica más crítica del negocio no está testeada. |
7.2 Documentación
Bien documentado:
- README.md (229 líneas) — overview completo con features y screenshots.
- docs/ARCHITECTURE.md (298 líneas) — capas, IPC, modelo, flujo de venta.
- docs/DATA_MODEL.md (301 líneas) — esquema SQL completo + ER.
- docs/ROADMAP.md (644 líneas) — fases, decisiones, riesgos.
- docs/ROADMAP-INTEGRACION.md (145 líneas) — features pendientes.
- docs/GUIA_DESARROLLADOR.md (674 líneas) — comandos, build, troubleshooting.
- docs/Caso-Venezuela.md — análisis regulatorio SENIAT.
- docs/UPDATER_NOTES.md, docs/AUDITORIA_COMPLETA_TOG_ADMIN_V3.md, etc.
Documentación débil:
- No hay JSDoc en funciones de IPC handlers (más allá de comentarios cortos).
- No hay OpenAPI / spec de la API IPC (los40+ canales solo documentados parcialmente en ARCHITECTURE.md).
- No hay ADRs (Architecture Decision Records) — decisiones como "por qué SQLite", "por qué Electron", "por qué RSA-2048" están dispersas en los docs.
7.3 Separación de capas
Aspecto	Estado	Detalle
Capas claras (UI / domain / data)	🟡 Parcial	Hay main/renderer/shared, pero la lógica de dominio vive en handlers IPC, no en una capa intermedia.
Repository pattern	❌ No	Queries SQL inline en cada handler.
Dependency Injection	❌ No	getDatabase() es singleton global, no inyectable.
Validación de entrada	✅ Sí (parcial)	Zod en handlers críticos (ventas, compras, productos), no en todos (categorias, proveedores, metodos-pago no usan Zod).
Manejo de errores	🟡 Parcial	Try/catch en la mayoría de handlers, pero errores se devuelven como { success: false, error: msg } en vez de tipos estructurados.
Logging estructurado	❌ No	Solo console.log + buffer circular para crash reports (Roadmap V3.2 lo reconoce como pendiente).
TypeScript strict	✅ Sí	tsconfig.json:15 "strict": true.
Aliases de path	✅ Sí	@/* y @shared/* en vite.config.ts:21-22 y tsconfig.json:21-22.
7.4 Deuda técnica que afectaría la modularización
#	Issue	Severidad	Impacto en modularización
1	ipc-handlers.ts monolítico de 1578 líneas	🔴 Alta	Cualquier división por dominio requiere separar handlers y reasignar registros.
2	Lógica de negocio entremezclada con IPC en handlers de venta/caja	🔴 Alta	Para extraer un "SalesService" hay que sacar la lógica de 6+ handlers.
3	Tipos duplicados en cada página (POSPage.tsx:15-34, CajaPage.tsx:11-23, etc.)	🟡 Media	Migración de tipos debe unificarse en shared/.
4	permissions.ts backend existe pero no se invoca en handlers	🔴 Alta seguridad	Cualquier cliente IPC bypasea los permisos.
5	getDbPath() duplicado en database.ts:13 y ipc-handlers.ts:1102	🟢 Baja	Indicio de code-smell.
6	Singleton db global mutable (database.ts:6)	🔴 Alta	Dificulta testing y multi-instancia.
7	localStorage side-effect a nivel de módulo (auth.store.ts:90)	🟡 Media	No testeable de forma aislada.
8	Token de GitHub residual en .env (cosmético, updater no lo usa)	🟢 Resuelto (2025)	.eliminado del entorno local; .gitignore ya lo bloqueaba; updater.ts no lo consume; repo público.
9	Métodos de pago "tarjeta" cableados a VP800 (metodos_pago:procesar-tarjeta llama a valorTerminal directamente, ipc-handlers.ts:1178-1197)	🟡 Media	Cualquier otro medio de cobro requiere editar el handler.
10	Sin tsconfig para main/ compartido con renderer (paths separados)	🟡 Media	tsconfig.json solo incluye renderer y shared.
11	react-hook-form, @hookform/resolvers, date-fns declarados pero no usados	🟢 Baja	Ruido en el bundle.
12	tipo Producto.unidad declarado como union literal pero realmente libre ('unidad' | 'paquete' | 'hoja' | 'servicio' en types.ts:56 vs string en Zod validations.ts:53)	🟡 Media	Drift entre tipos TS y validación.
13	Recetas/hardcoded de UI strings bilingües con i18n.language === 'en' ? '...' : '...' (varios archivos todavía, aunque ROADMAP dice "completado")	🟢 Baja	El ROADMAP-Fase-I documenta la migración; residuo menor.
14	No hay servicio de "ventas" / "caja" / "inventario" como clases/funciones puras	🔴 Alta	Toda la lógica de dominio está acoplada al ciclo de vida del handler IPC.
15	Versionado de migraciones por string ('001_usuarios') en vez de timestamp	🟡 Media	Riesgo de conflictos en merges paralelos.
7.5 Resumen de madurez
Dimensión	Calificación	Comentario
Funcionalidad	⭐⭐⭐⭐⭐	Producto verticalmente completo para su nicho (POS de mostrador).
Seguridad funcional	⭐⭐⭐ (con hueco)	bcrypt, rate-limit, contextIsolation, CSP pendiente — permissions backend inerte.
Arquitectura	⭐⭐	Capas rotas: dominio ↔ IPC ↔ datos mezclados. No hay service layer.
Modularidad	⭐⭐	Monolito, pero con buen aislamiento main/renderer.
Testabilidad	⭐⭐	Capa shared/ y UI testeadas; backend sin cobertura.
Documentación	⭐⭐⭐⭐	Rica en docs de producto y arquitectura; pobre en API interna.
Deuda técnica	⭐⭐	Acumulada pero identificable y refactorizable con esfuerzo acotado.
8) Veredicto final### ¿TOG Admin es viable como módulo "Comercialización" dentro de un ERP vertical por industria (maíz → hojuelas → distribución)?
Respuesta: SÍ, pero NO directamente. Es viable como base conceptual y código de referencia, pero NO como módulo drop-in.
Por qué SÍ
1. El modelo de datos es genérico de "venta / compra / caja / inventario / cotización" — los conceptos centrales (cliente, producto, stock, venta con detalles, caja con conciliación) son exactamente los que necesita un módulo de Comercialización en un ERP de cualquier vertical (incluyendo distribución de hojuelas de maíz).
2. El flujo de negocio está bien implementado en términos de reglas: validación de stock, transacciones atómicas, descuentos, devoluciones, múltiples métodos de pago, numeración secuencial, auditoría.
3. Las reglas están testeadas en su mayoría (Zod schemas, permisos) y la documentación es muy buena para reusar la lógica.
4. El stack es moderno y mantenible (Electron 31 + React 18 + TS5.4 + SQLite/Postgres-friendly).
5. El roadmap ya contempla multi-sucursal, combos, fiscal, multi-moneda — alineado con un ERP de distribución.
6. El sistema de permisos granular (28 permisos en 7 categorías) es un buen punto de partida para autorización por módulo/rol en el ERP.
Por qué NO directamente
1. Está acoplado a Electron y a SQLite monolítico single-PC — para un ERP multi-sede necesitas servidor central, concurrencia, multi-usuario, red. La migración a Postgres/MySQL es una reescritura sustancial.
2. La "Industria del maíz → hojuelas → distribución" introduce entidades de dominio que no existen en TOG Admin:
- Lotes / batch tracking (trazabilidad por lote desde el campo)
- Fechas de vencimiento / caducidad
- Unidades de conversión (kg ↔ toneladas ↔ sacos)
- Recetas / BOM (qué hojuelas salen de qué maíz)
- Centros de costo / procesos productivos
- Rutas de distribución, flotas, clientes con crédito
- Múltiples almacenes / ubicaciones
- Clientes formalizados (TOG ni siquiera tiene tabla de clientes para ventas; sólo en cotizaciones como texto)
- Impuestos compuestos (TOG tiene un único sales_tax_rate plano)
3. La capa de dominio NO está separada del transporte (todo en ipc-handlers.ts). Para reusar la lógica necesitas extraer un servicio de dominio por entidad (SalesService, CashRegisterService, InventoryService, PurchaseService, QuotationService).
4. El god-object window.api con 80+ métodos tendría que partirse en una fachada por bounded context del ERP (Inventario, Comercialización, Financiero, etc.).
5. Faltan piezas para "Comercialización" en sentido ERP:
- Clientes (entidad formal, no texto)
- Listas de precios por cliente / categoría
- Condiciones de pago, crédito, cuotas
- Pedidos (sales orders) distintos de ventas (entrega inmediata)
- Remitos / despacho   - Devoluciones parciales con nota de crédito
- Conciliación bancaria6. Hay un agujero de seguridad real: permissions.ts en el main process está desconectado de los IPC handlers. En un ERP esto no se puede permitir.
6. El token de GitHub en .env indica falta de prácticas de seguridad que un ERP multi-empresa requiere.
Recomendación: estrategia de adopción en 3 fases
Fase	Acción	Esfuerzo estimado
Fase A: Extracción limpia	1) Crear monorepo (npm workspaces o pnpm). 2) Mover src/shared/ a @erp/shared. 3) Extraer src/main/db/ + services/ a @erp/comercializacion-core (lógica de dominio + repositorios). 4) Mover src/renderer/pages/POS*, Inventario*, Compras*, Ventas*, Caja*, Quotes*, Reportes* a @erp/comercializacion-ui. 5) Partir ipc-handlers.ts en handlers por bounded context. 6) Partir preload.ts en fachadas por dominio. 7) Reemplazar window.api.X por window.comercializacionApi.X.	6–10 semanas
Fase B: Abstracción de persistencia	1) Introducir ORM (Drizzle recomendado, mejor tipado y migraciones timestamp). 2) Reescribir las queries inline detrás de IRepository<T>. 3) Hacer la DB configurable (SQLite para dev, Postgres para prod). 4) Añadir multi-tenant (empresa_id en cada tabla). 5) Conectar requirePermission a TODOS los handlers. 6) Eliminar singletons globales; usar DI.	8–12 semanas
Fase C: Extensión al dominio vertical (maíz → hojuelas)	1) Añadir entidades: Cliente, Lote, Receta, Almacen, Ubicacion, RutaDistribucion, Pedido, Remito, ListaPrecio. 2) Migrar Venta → Pedido → Remito → Factura como flujo. 3) Listas de precios escalonadas por cliente/segmento. 4) Cuentas por cobrar. 5) Conversión de unidades (kg, ton, saco, hojuela). 6) Trazabilidad lote-origen.	12–16 semanas
Veredicto en una línea
TOG Admin es una base sólida y bien ejecutada para un POS de mostrador, con modelo de datos casi compatible con un módulo de Comercialización de ERP, pero NO es un módulo de ERP hoy — es un producto standalone monolítico Electron+SQLite con buena lógica de dominio escondida dentro de handlers IPC, varios singletons globales, acoplamiento fuerte a Electron, y ausencia de las entidades propias de distribución (clientes, pedidos, lotes, almacenes, crédito, multi-moneda, multi-tenant). Convertirlo en módulo es viable con un refactor de 6–10 semanas + extensión de 12–16 semanas, pero NO reutilizable como drop-in.
Riesgos clave a mitigar antes de cualquier intento:
1. ~~🔴 Rotar el GH_TOKEN en .env y sacarlo del repositorio inmediatamente.~~ **Resuelto:** token eliminado del entorno local; el updater nunca lo consumió; repo público.
2. 🔴 Conectar requirePermission en TODOS los handlers IPC (hoy es bypasseable).
3. 🔴 Romper el monolito ipc-handlers.ts antes de que crezca más.
4. 🟡 Abstraer acceso a SQLite tras IRepository<T> para no estar atado a un motor.
5. 🟡 Eliminar singletons mutables (db, configCache, loginAttempts) en favor de DI.
6. 🟡 Unificar tipos en src/shared/ y eliminar las redeclaraciones por página.
Archivo clave para empezar el refactor: src/main/ipc-handlers.ts (1578 líneas) — es el nodo de mayor densidad de deuda arquitectónica.