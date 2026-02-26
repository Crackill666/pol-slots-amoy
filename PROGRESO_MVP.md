# Progreso MVP - POL Slots (Amoy)

Fecha de actualización: 2026-02-21

## Estado actual

El MVP funciona en Polygon Amoy y está publicado en GitHub Pages.

- Frontend online: `https://crackill666.github.io/pol-slots-amoy/`
- Red: Polygon Amoy (chainId `80002`)
- Contrato activo (nuevo): `0x548756B36D7352d23e2c90DE5EA169198eD443E4`
- Contrato anterior (ya no usar): `0x52976660aEE6e5DeD5376A779B04A0abd58381f5`

## Cambios implementados en esta sesión

### Contrato (`contracts/PolSlotsAmoy.sol`)

- Se mantiene `spin()` con apuesta exacta de `1 POL` (`msg.value == 1e18`).
- Se actualizó la banca mínima previa al spin a `30 POL` (`MAX_PAYOUT = 30e18`).
- Nueva distribución fija en basis points (total 10.000):
  - 38.00% -> x0 (0.00 POL)
  - 32.00% -> x1 (1.00 POL)
  - 16.00% -> x1.25 (1.25 POL)
  - 8.50% -> x2 (2.00 POL)
  - 3.50% -> x3 (3.00 POL)
  - 1.50% -> x5 (5.00 POL)
  - 0.40% -> x10 (10.00 POL)
  - 0.10% -> x30 (30.00 POL)
- Se mantiene pago en la misma transacción con `call`.
- Se mantiene `deposit()`, `receive()` y `withdraw(uint256)` solo owner.

### Frontend (Vite + Vanilla + ethers)

- Tabla de premios actualizada a los nuevos multiplicadores/probabilidades.
- Mensajes UI de resultado actualizados para 8 outcomes (`0..7`).
- Reels corregidos con símbolos válidos (se eliminó mojibake/encoding roto).
- Nuevo cuadro de saldo del jugador: `Saldo wallet: X POL`.
- Branding del header actualizado:
  - Logo `assets/Logo2MN.png`
  - Título simplificado a `POL-SLOT`.

### Encoding y estabilidad

- Archivos clave guardados en UTF-8 limpio para evitar errores por BOM/mojibake:
  - `contracts/PolSlotsAmoy.sol`
  - `src/main.js`
  - `index.html`
  - `src/style.css`

## Deploy y configuración

- Deploy nuevo ejecutado en Amoy.
- Dirección resultante: `0x548756B36D7352d23e2c90DE5EA169198eD443E4`.
- `.env` local actualizado con esa dirección en:
  - `VITE_CONTRACT_ADDRESS`
  - `CONTRACT_ADDRESS`
- Importante en GitHub Pages:
  - El workflow usa `VITE_CONTRACT_ADDRESS` desde `GitHub Secrets`, no desde `.env` local.
  - Si aparece `Bank: 0,00 POL` en web pública, revisar y actualizar el secret.

## Pruebas y simulaciones realizadas

### Pruebas on-chain reales

- Se ejecutaron pruebas reales en Amoy (depósito + spins).
- Corrida extensa: 50 spins confirmados (con reintentos técnicos).
- Resultado de esa corrida:
  - Wager total: `50 POL`
  - Payout total: `46.25 POL`
  - PnL banco (sin gas): `+3.75 POL`

### Simulación local (sin tocar contrato)

- 10.000 tiradas con banca inicial 100 POL:
  - Banca final: `937.75 POL`
  - PnL: `+837.75 POL`
- EV teórico por tirada:
  - RTP jugador ~94%
  - Edge banco ~6%
  - Ganancia esperada banco: `~0.06 POL` por tirada

## Operación recomendada

- Mínimo estricto para permitir spin sin revert: `30 POL`.
- Recomendado para operación estable: `40-50 POL` como piso operativo.
- Para 1000 tiradas con menor riesgo de corte por banca, considerar `120+ POL`.

## Variables y secrets usados

### `.env` local

- `AMOY_RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `VITE_AMOY_RPC_URL`
- `VITE_CONTRACT_ADDRESS`
- `VITE_MIN_MAX_FEE_GWEI`
- `VITE_MIN_PRIORITY_FEE_GWEI`
- `VITE_SPIN_GAS_LIMIT`

### GitHub Actions Secrets

- `VITE_CONTRACT_ADDRESS`
- `VITE_AMOY_RPC_URL`
- `VITE_MIN_MAX_FEE_GWEI`
- `VITE_MIN_PRIORITY_FEE_GWEI`
- `VITE_SPIN_GAS_LIMIT`

## Comandos útiles

```bash
npm run dev
npm run build
npm run compile
npm run deploy:amoy
npm run verify:amoy
```
