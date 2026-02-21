# Progreso MVP - POL Slots (Amoy)

Fecha: 2026-02-20

## Estado actual

El MVP funciona en Polygon Amoy y ya está publicado en GitHub Pages.

- Frontend online: `https://crackill666.github.io/pol-slots-amoy/`
- Contrato desplegado: `0x52976660aEE6e5DeD5376A779B04A0abd58381f5`
- Red: Polygon Amoy (chainId 80002)

## Lo que se implementó

### Contrato (`contracts/PolSlotsAmoy.sol`)

- `spin()` con apuesta exacta de 1 POL (`msg.value == 1e18`)
- Validación de banca previa al spin: balance previo >= 8 POL
- Distribución fija de probabilidades/payouts:
  - 12.0% -> 0.00
  - 58.0% -> 0.95
  - 24.0% -> 1.00
  - 5.0% -> 1.10
  - 0.9% -> 3.00
  - 0.1% -> 8.00
- Pago en la misma transacción con `call`
- Evento `SpinResult`
- `deposit()` + `receive()`
- `withdraw(uint256)` solo owner
- Estructura comentada para migrar random a VRF en fase futura

### Frontend (Vite + Vanilla + ethers)

- Diseño neon cyberpunk mobile-first
- Conexión MetaMask
- Verificación/switch de red a Amoy
- Lectura de bank balance del contrato
- Flujo UX: confirmar wallet -> pendiente -> resultado
- Reels visuales coherentes con outcome on-chain
- Historial local de últimas 5 tiradas con tx hash
- Tabla de premios siempre visible
- Formato decimal con coma en UI

### Mejoras hechas durante pruebas

- Corrección de BOM/encoding que rompía Vite
- Ajuste de gas mínimo configurable en spin:
  - `VITE_MIN_MAX_FEE_GWEI`
  - `VITE_MIN_PRIORITY_FEE_GWEI`
  - `VITE_SPIN_GAS_LIMIT`
- Panel `Banco (Owner)`:
  - Visible solo para owner
  - Depositar/retiar desde UI
  - Movido al final de la página

## Deploy y repo

- Repo GitHub creado y publicado
- GitHub Pages configurado con Source = GitHub Actions
- Workflow creado: `.github/workflows/deploy.yml`
- `vite.config.js` configurado con base:
  - `base: "/pol-slots-amoy/"`

## Variables/secrets usados

### `.env` local (dev/deploy)

- `AMOY_RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `VITE_AMOY_RPC_URL`
- `VITE_CONTRACT_ADDRESS`
- `VITE_MIN_MAX_FEE_GWEI`
- `VITE_MIN_PRIORITY_FEE_GWEI`
- `VITE_SPIN_GAS_LIMIT`

### Secrets en GitHub Actions

- `VITE_CONTRACT_ADDRESS`
- `VITE_AMOY_RPC_URL`
- `VITE_MIN_MAX_FEE_GWEI`
- `VITE_MIN_PRIORITY_FEE_GWEI`
- `VITE_SPIN_GAS_LIMIT`

## Pendientes sugeridos (próxima sesión)

1. Normalizar caracteres UTF-8 en `src/main.js` (hay textos que se ven con encoding raro en algunas ediciones).
2. Refinar mensajes de error para `custom errors` del contrato (mapear `InsufficientBankBeforeSpin`, etc).
3. Agregar tests Hardhat para distribución y reglas críticas.
4. (Opcional) verificación del contrato en Polygonscan.
5. Preparar plan de migración a Chainlink VRF (siguiente fase).

## Comandos útiles

```bash
npm run dev
npm run build
npm run compile
npm run deploy:amoy
npm run verify:amoy
```