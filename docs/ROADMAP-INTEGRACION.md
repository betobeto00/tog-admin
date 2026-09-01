¡Excelente lista de funcionalidades! Te voy a ayudar a estructurar este roadmap de desarrollo para TOG Admin, priorizando y organizando las tareas en fases lógicas. He analizado cada característica y las he clasificado por complejidad, dependencias y valor para el negocio.

## 🗺️ Roadmap de Desarrollo para TOG Admin

### Fase 1: Mejoras Fundamentales del Producto (Base de Datos y Modelos)
*Objetivo: Sentar las bases de datos para todas las funcionalidades futuras.*

| Característica | Prioridad | Complejidad | Dependencias | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **Al crear producto: identificar si es Producto o Servicio** | 🔴 Alta | 🟢 Media | Ninguna | **Base para todo.** Requiere modificar la tabla `products` y todas las pantallas que lo usan (POS, inventario, reportes). |
| **Crear Subcategorías de productos** | 🔴 Alta | 🟢 Media | Ninguna | Mejora la organización del inventario. Requiere tabla `subcategories` relacionada con `categories`. |
| **Añadir Marca al producto (opcional)** | 🟡 Media | 🟢 Baja | Ninguna | Campo adicional en `products`. Simple de implementar. |
| **Subir imagen del producto (opcional)** | 🟡 Media | 🟢 Baja | Ninguna | Almacenar rutas de imágenes en DB y gestionar archivos en el sistema de archivos local. |

**Acciones Inmediatas:**
1.  Diseñar y aplicar **migraciones SQLite** para:
    - Añadir columna `type` (ENUM: 'product', 'service') a `products`.
    - Añadir columna `brand` (TEXT) a `products`.
    - Añadir columna `image_path` (TEXT) a `products`.
    - Crear tabla `subcategories` con `id`, `name`, `category_id`.
2.  Actualizar los **schemas de Zod** en `src/shared/validations.ts`.
3.  Modificar el **formulario de creación/edición de productos** en el renderer para incluir estos nuevos campos.

---

### Fase 2: Experiencia de Usuario y Funcionalidades Clave
*Objetivo: Añadir características de alto valor que mejoren la operación diaria.*

| Característica | Prioridad | Complejidad | Dependencias | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **Exportar Cotización a PDF** | 🔴 Alta | 🟡 Media-Alta | Fase 1 | Requiere librería (ej. `pdf-lib`, `jsPDF` o `electron-pdf`). Diseñar un template bonito. |
| **Armar Combos de productos** | 🔴 Alta | 🔴 Alta | Fase 1 | **Complejo.** Requiere una nueva tabla `combos` y `combo_products` (relación muchos a muchos). Lógica en el POS para aplicar descuentos y gestionar stock de los componentes. |
| **Ver Integra (YA LO HICISTE)** | ✅ Completado | - | - | Ya tienes el benchmarking listo. |

**Consideraciones de Diseño:**
- **PDF:** Investiga cómo generar PDFs en Electron. Puedes usar el proceso principal para renderizar un HTML a PDF o usar una librería directamente en el renderer.
- **Combos:** Define la lógica de negocio: ¿El combo tiene un precio fijo? ¿Un descuento sobre la suma de sus partes? ¿Cómo afecta al stock al vender un combo?

---

### Fase 3: Expansión y Escalabilidad (Multi-sucursal y Multi-caja)
*Objetivo: Transformar TOG Admin de una app de una sola PC a un sistema multi-sucursal.*

| Característica | Prioridad | Complejidad | Dependencias | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **Ampliar a Multicaja con DB compartida** | 🟡 Media | 🔴 Alta | Fase 1, Fase 2 | **Cambio arquitectónico profundo.** Implica migrar de SQLite local a un servidor SQL (PostgreSQL/MySQL) y manejar concurrencia. |
| **Conexión intersucursal** | 🟡 Media | 🔴 Muy Alta | Multicaja | Requiere sincronización de datos (inventario, ventas, clientes) entre diferentes bases de datos/servidores. Es un proyecto en sí mismo. |

**Análisis de Arquitectura:**
- **Opción A (Recomendada a corto plazo):** Migrar a **SQLite con acceso en red** (ej. usando un archivo .db en una unidad de red compartida). Es más simple, pero tiene problemas de rendimiento y bloqueo con múltiples usuarios.
- **Opción B (La correcta a largo plazo):** **Refactorizar la capa de base de datos** para que sea agnóstica al motor (usar un ORM como Prisma o Drizzle). Luego, migrar a **PostgreSQL/MySQL** en un servidor central.
- **Conexión intersucursal:** Esto es un nivel más complejo. Podrías considerar una **API central** a la que todas las sucursales se conecten, o un sistema de **sincronización periódica**.

---

### Fase 4: Cumplimiento Fiscal y Despliegue
*Objetivo: Cumplir con requisitos legales y facilitar la instalación.*

| Característica | Prioridad | Complejidad | Dependencias | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **Descargar CSV para declaración de impuestos formato SENIAT** | 🟡 Media | 🟢 Media | Fase 1 | Investigar el formato exacto que requiere el SENIAT. Generar un reporte que exporte a CSV con las columnas necesarias. |
| **Armar Instalador para X32 y X64** | 🟡 Media | 🟢 Baja | Ninguna | En `electron-builder`, configurar `target: ['nsis', 'nsis:x64']` o similar. Ya tienes la base con NSIS. |

**Pasos para el Instalador:**
1.  Modificar el archivo `package.json` en la sección `build.win.target`.
2.  Probar la generación de instaladores en ambas arquitecturas.
3.  Actualizar la documentación para indicar qué instalador usar según el sistema.

---

### Fase 5: Experiencia Premium (Pantalla Auxiliar)
*Objetivo: Mejorar la experiencia del cliente en el punto de venta.*

| Característica | Prioridad | Complejidad | Dependencias | Observaciones |
| :--- | :--- | :--- | :--- | :--- |
| **Habilitar pantalla Auxiliar para clientes** | 🟢 Baja | 🟡 Media-Alta | Fase 2 | **Requiere una segunda ventana de Electron** o un navegador web. Debe mostrar en tiempo real los productos agregados al carrito y el total. |

**Enfoque Técnico:**
1.  **Crear una nueva ventana de Electron** (sin controles de ventana, a pantalla completa) en un monitor secundario.
2.  Esta ventana se comunicará con el proceso principal via IPC para recibir las actualizaciones del carrito.
3.  Puedes diseñar una interfaz atractiva y minimalista para que el cliente vea su compra.

---

## 📋 Plan de Implementación Recomendado (Sprints)

### Sprint 1: Base de Datos y Modelos (2-3 semanas)
- [ ] Implementar todas las migraciones de la **Fase 1**.
- [ ] Actualizar el formulario de productos.
- [ ] Actualizar el POS para que maneje correctamente "Productos" y "Servicios".

### Sprint 2: PDF y Combos (3-4 semanas)
- [ ] Implementar la **exportación a PDF** de cotizaciones/presupuestos.
- [ ] Diseñar e implementar la lógica y UI para **crear y gestionar Combos**.
- [ ] Modificar el POS para añadir combos al carrito y gestionar su stock.

### Sprint 3: Reportes e Instalador (1-2 semanas)
- [ ] Implementar el **reporte CSV para SENIAT**.
- [ ] Configurar `electron-builder` para generar instaladores de 32 y 64 bits.
- [ ] Probar y documentar el proceso de instalación.

### Sprint 4 (Largo Plazo): Multi-sucursal (4-6+ semanas)
- [ ] **Estudiar y elegir la arquitectura** (API central vs. sincronización).
- [ ] Refactorizar la capa de base de datos para usar un ORM.
- [ ] Migrar de SQLite local a PostgreSQL/MySQL en servidor.
- [ ] Implementar la lógica de autenticación y sesiones para múltiples usuarios/cajas.

### Sprint 5: Pantalla Auxiliar (2-3 semanas)
- [ ] Crear la nueva ventana de Electron para el cliente.
- [ ] Establecer la comunicación IPC para actualizar el carrito en tiempo real.
- [ ] Diseñar la interfaz de la pantalla auxiliar.

---

## 💡 Recomendaciones Adicionales

1.  **Documentación Técnica:** A medida que implementes estas características, actualiza la documentación en la carpeta `docs/`. Esto será vital para ti y para futuros contribuyentes.

2.  **Pruebas:** Para cada funcionalidad nueva, escribe pruebas unitarias y de integración (como ya haces con Vitest). Esto es especialmente crítico para los Combos y la lógica de inventario.

3.  **Rendimiento:** La migración a multi-sucursal con base de datos compartida es el cambio más delicado. Asegúrate de hacer pruebas de carga y optimizar las consultas SQL.

4.  **Feedback de Usuarios:** Antes de invertir mucho tiempo en la pantalla auxiliar o la conexión intersucursal, valida con usuarios reales (dueños de papelerías) si estas características son realmente necesarias para ellos. Prioriza lo que resuelve problemas reales.

5.  **Seguridad:** Al migrar a una base de datos en servidor, la seguridad se vuelve crítica. Implementa cifrado de conexiones (TLS) y buenas prácticas de autenticación.

Este roadmap te da una visión clara de por dónde empezar y cómo escalar el proyecto de manera sostenible. ¡Éxito con TOG Admin!



Peticion Original: 

ok, esta otra peticion es aparte, ayudame a estructurar esto para desarrollarlo e integrarlo en TOG Admin: Crear Sub categorías de productos 
Añadir marca cuando se agregan productos opcional
Subir imagen del producto opcional al crearlo
Exportar cotización a PDF
Ampliar a Multicaja con DB compartida
Conexión intersucursal
Descargar CVS para declaración de impuestos formato Seniat.
Armar un Instalador para X32 y X64
Al crear un nuevo producto identificar si es Producto o servicio.
Armar Combos de productos.
Ver Integra (YA LO HICISTE)

Agregar habilitar pantalla Auxiliar para clientes (Segunda pantalla que ven los clientes detras de la caja.