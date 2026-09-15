# Changelog — tog-admin (TOG Admin POS)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Vinculación con el vendedor (FASE 5)**: campo opcional "ID de Vendedor" (OMV-XXXXX) en
  `LicenseSyncForm`, enviado a tog-platform tras descargar la licencia
  (`POST /api/empresas/:id/vendedor`). Si la vinculación falla, la licencia queda activa
  y se muestra un aviso.
- Tests de vinculación en `src/main/services/license-sync.test.ts` (formato inválido,
  vendedor inexistente, idempotencia y reenvío de `deviceFingerprint`)

### Fixed
- `license:sync` / `license:sync-account`: el handler IPC descartaba `deviceFingerprint`,
  así que el binding de dispositivo nunca llegaba al backend en el flujo de cuenta

### Added
- Modules documentation (docs/MODULOS.md) updated with Crixto as operational payment provider
- Module roadmap updated: Crixto integration marked complete, conciliation added
- Developer guide (docs/GUIA_DESARROLLADOR.md) and architecture docs updated
- QA sync script (scripts/qa-sync.ts) env vars updated: JWT_SECRET, PAYMENT_HMAC_SECRET

### Changed
- **Payment provider: Stripe → Crixto** across all documentation
  - docs/MODULOS.md: "En espera (Stripe)" → "Online automático (operativo) (Crixto)" with HMAC anti-replay
  - docs/README.md: removed FACTURACION-STRIPE.md, auto-license-stripe.md; added Crixto reference
  - docs/historia/ARQUITECTURA-MODULAR.md: Sync online status 🟡 → ✅, backend Node en Railway + Crixto
  - docs/historia/NEXT-SESSION.md: Stripe Checkout struck through, marked descartado
  - scripts/qa-sync.ts: STRIPE_SECRET_KEY removed, JWT_SECRET + PAYMENT_HMAC_SECRET added
- Documentation marked as historical where Stripe was discussed:
  - docs/historia/CONVERSACION-2025-09-01.md: added historical warning banner
  - docs/historia/NEXT-SESSION.md: added historical note

### Removed
- docs/historia/FACTURACION-STRIPE.md (full Stripe integration design doc)
- docs/historia/auto-license-stripe.md (brainstorming draft for Stripe auto-license)
- All active Stripe references from documentation

### Security
- Documented HMAC anti-replay for license activation flow
- Updated module licensing to reference emitirLicenciaConModulos (server-side)