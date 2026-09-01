# AGENTS.md — Instrucciones para asistentes AI en TOG Admin

> Este archivo es leído automáticamente por opencode (y otros asistentes AI compatibles) al inicio de cada sesión. Define cómo el agente debe trabajar en este repositorio.

---

## graphify

Este repositorio usa **graphify** para mantener un grafo de conocimiento navegable del código y los docs. Está integrado en opencode vía el plugin `.opencode/plugins/graphify.js`.

**Reglas para el agente:**

1. **Antes de responder preguntas sobre el código, lee `graphify-out/graph.json` y `graphify-out/GRAPH_REPORT.md`.** Si existen, úsalos como fuente primaria; son la representación navegable del repo.
2. **Usa `/graphify query "<pregunta>"`** cuando el usuario pregunte cómo funciona algo, qué llama a qué, o trace un flujo. El grafo ya está construido; no lo reextraigas.
3. **Si el usuario pide cambios estructurales** (nuevos archivos, mover carpetas, renombrar), reconstruye el grafo al final con `graphify` o avisa que el hook post-commit lo hará automáticamente.
4. **NUNCA** ejecutes un build completo de graphify (`graphify .`) si ya existe `graphify-out/graph.json` y la pregunta es sobre el código — usa query.
5. **Sí** ejecuta `graphify .` cuando:
   - Se agreguen muchos archivos nuevos.
   - El usuario lo pida explícitamente.
   - El hook post-commit reporte errores.

**Comandos útiles:**

| Comando | Cuándo |
|---------|--------|
| `graphify query "<pregunta>"` | Responder pregunta sobre el código (preferido) |
| `graphify path "NodoA" "NodoB"` | Trace de dependencias / flujo entre dos entidades |
| `graphify explain "NodoX"` | Explicación en lenguaje natural de un nodo |
| `graphify .` | Build completo (solo cuando sea necesario) |
| `graphify --update` | Build incremental |
| `graphify hook status` | Verificar hooks post-commit |
| `graphify export html` | Regenerar visualización HTML |

**Estado actual:** ver `graphify-out/GRAPH_REPORT.md` para secciones "God Nodes", "Surprising Connections" y "Suggested Questions" después del primer build.

---

## Convenciones del repo

- **Lenguaje:** TypeScript estricto (`tsc --noEmit` debe pasar).
- **Tests:** Vitest. Correr `npm test` antes de commit.
- **Estilo:** NO agregar comentarios al código salvo que el usuario lo pida explícitamente.
- **Commits:** mensajes en inglés, una línea, imperativo. NO commitear sin que el usuario lo pida.
- **Seguridad:** NUNCA commitear secretos. `.env` ya está en `.gitignore`.

## Arquitectura

- TOG Admin es un POS desktop (Electron 31 + React 18 + TypeScript + SQLite).
- La capa de dominio está extraída parcialmente a `src/main/services/`.
- Los handlers IPC viven en `src/main/ipc-handlers.ts` (legacy monolítico, en proceso de modularización).
- La visión de plataforma modular (módulos activables por licencia) vive en https://github.com/betobeto00/tog-platform.

Ver `docs/MODULOS.md` (referencia conceptual, no migrado aún), `docs/INFORME-ERP.md` (auditoría), `docs/ARQUITECTURA-MODULAR.md` (plan de modularización).

## Permisos IPC

Los handlers IPC DEBEN validar permisos con `checkPermissionOrFail(data, channel, permission)` antes de ejecutar lógica de negocio. Handlers públicos solo: `app:version`, `i18n:get-lang`, `i18n:set-lang`, `crash-report:save`, `auth:login`, `license:status`, `license:validate`.