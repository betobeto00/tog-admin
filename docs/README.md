# Índice de documentación — TOG Admin

> Regla del ecosistema: **un tema, un archivo canónico**. Separa siempre
> **HOY** (verdad verificada en código) de **VISIÓN/FUTURO** y de
> **REGISTRO HISTÓRICO**. Los docs históricos viven en `docs/historia/` y
> no se actualizan.

## Canon operativo (esta carpeta)

| Archivo | Qué es la fuente de |
|---|---|
| `ARCHITECTURE.md` | Arquitectura interna real: capas, IPC, DB, red local, seguridad |
| `FEATURES.md` | Estado por feature (prioridad/estado por módulo) |
| `MODULOS.md` | Catálogo de módulos activables (espejo de `tog-platform/docs/MODULOS.md`, que es el canónico) |
| `LICENCIAMIENTO.md` | Flujo de licencias offline + Sincronizar + max_pcs |
| `QA-SYNC.md` | QA del flujo Sincronizar |
| `UPDATER_NOTES.md` | Notas del updater (latest.yml, blockmap, release) |
| `GUIA_DESARROLLADOR.md` | Onboarding de desarrollo |
| `MANUAL_USUARIO.html` | Manual de usuario final |
| `README.md` (índice) | Este archivo: reglas de canon + qué vive dónde |

## Historia (`docs/historia/`)

Registros, no fuentes de verdad. No se actualizan; se archivan.

`ROADMAP.md` · `ROADMAP-INTEGRACION.md` · `FASE-5-PRODUCTOS.md` · `KNOWLEDGE.md` · `CONVERSACION-2025-09-01.md` · `AUDITORIA_COMPLETA_TOG_ADMIN_V3.md` · `ANALISIS_PERFORMANCE_UNA_PC.md` · `INFORME-ERP.md` · `benchmarkin-Integra-POS.md` · `Caso-Venezuela.md` · `ARQUITECTURA-MODULAR.md` · `PRODUCTION_BUILD_REPORT.md` · `DATA_MODEL.md` · `MONEDA.md` · `Sistema-COD-BARRAS.md` · `DISENO-MODULO-RESTAURANTE.md` · `TECH_STACK.md` · `NEXT-SESSION.md` · `REMEDIACION_INFORME_SEGURIDAD.md`

> La auditoría `INFORME_SEGURIDAD_TOG_ADMIN.md` (raíz de `docs/`) es un insumo del
> binario desempaquetado, no fuente de verdad: su certificación contra el código
> y su remediación viven en `docs/historia/REMEDIACION_INFORME_SEGURIDAD.md`.
>
> Notas: el diseño de cobro online (Crixto) vive en `tog-platform/docs/FACTURACION-CRIXTO.md`.
> **Stripe fue descartado**: las bitácoras archivadas que lo mencionan son históricas,
> no describen el sistema actual.
> El estado de red local (TLS + heartbeat) vive en `ARCHITECTURE.md` y
> `tog-platform/docs/INTERCONEXION-RED.md`.

## Números clave verificados contra código (6-Sep-2026)

La fuente de estos números es el código, no la doc. Cuando cambie el código,
actualiza aquí y en la doc canónica correspondiente:

| Métrica | Valor real | Fuente |
|---|---|---|
| Permisos | **69 en 15 categorías** | `src/shared/permissions.ts` (`PERMISSIONS`, `ROLE_DEFAULTS`, `USER_ROLES`) |
| Tests | **444 tests en 37 archivos** | `npm test` (Vitest) |
| Migraciones DB | **001–048** | `src/main/db/database.ts` |
| Páginas renderer | **26** | `src/renderer/pages/*.tsx` |
| Módulos main | **17** | `src/main/modules/` |
| Servicios main | **14** | `src/main/services/` (sin contar `.test.ts`) |
| i18n renderer | **~1,862 keys/idioma** | `src/renderer/i18n/locales/{es,en}/translation.json` |
| i18n main | **~98 keys** | `src/main/i18n/locales/{es,en}.json` |

## Reglas para no volver a dispersar

1. Un cambio de números clave se refleja **solo** en el doc canónico del tema (y en este índice si aplica).
2. Antes de crear un doc nuevo: ¿puede vivir dentro de uno existente? Si no, crearlo en la raíz de `docs/` solo si es canon; si es histórico/plan, va directo a `docs/historia/`.
3. Duplicados cross-repo: el canónico es el de `tog-platform` para catálogo de módulos, cobro online y arquitectura modular; tog-admin mantiene espejos cortos que apuntan allá.
4. Un doc grande con ciclo propio (ej. `MANUAL_USUARIO.html`) se mantiene con su propio criterio o se archiva; no se edita a medias.
