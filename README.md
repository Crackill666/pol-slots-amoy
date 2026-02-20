# POL Slots (Amoy) - MVP

Slot on-chain (sin backend, sin NFTs) para Polygon Amoy.
Cada tirada cuesta exactamente **1 POL**, requiere **1 confirmación** de wallet, y paga en la **misma transacción** si corresponde.

## Stack

- Solidity + Hardhat
- Frontend estático con Vite + Vanilla JS
- ethers.js para interacción wallet

## Requisitos

- Node.js 18+
- MetaMask
- POL de testnet en Amoy

## 1) Instalar

```bash
npm install
```

## 2) Configurar entorno

Copiá `.env.example` a `.env` y completá valores:

```bash
cp .env.example .env
```

Variables clave:

- `AMOY_RPC_URL`: RPC de Polygon Amoy
- `PRIVATE_KEY`: clave privada del deployer
- `POLYGONSCAN_API_KEY`: opcional para verify
- `CONTRACT_ADDRESS`: usada por script de verify
- `VITE_CONTRACT_ADDRESS`: dirección del contrato para frontend
- `VITE_AMOY_RPC_URL`: RPC para lectura del bank balance
- `VITE_MIN_MAX_FEE_GWEI`: piso de max fee por gas para `spin` (EIP-1559)
- `VITE_MIN_PRIORITY_FEE_GWEI`: piso de priority fee para `spin`
- `VITE_SPIN_GAS_LIMIT`: límite de gas enviado en `spin`

## 3) Compilar contrato

```bash
npm run compile
```

## 4) Deploy a Amoy

```bash
npm run deploy:amoy
```

El script imprime la dirección deployada. Copiala en:

- `.env` -> `CONTRACT_ADDRESS`
- `.env` -> `VITE_CONTRACT_ADDRESS`

## 5) (Opcional) Verificar contrato en Polygonscan

```bash
npm run verify:amoy
```

## 6) Correr frontend local

```bash
npm run dev
```

Abrí la URL que muestra Vite (por defecto `http://localhost:5173`).

## 7) Build para producción (hosting estático)

```bash
npm run build
```

Se genera `dist/` con archivos estáticos.

## Flujo del juego

1. Usuario conecta MetaMask.
2. Si la red no es Amoy, la UI solicita switch.
3. Botón `SPIN - 1 POL` llama `spin()` enviando `1 POL`.
4. Wallet confirma 1 transacción.
5. Contrato calcula resultado, paga si corresponde en esa misma tx y emite evento.
6. UI muestra mensaje, frena rodillos y agrega al historial local (últimas 5).

## Reglas económicas implementadas

- Apuesta fija: `1e18` (1 POL)
- Distribución exacta:
  - 12.0% -> 0.00 POL
  - 58.0% -> 0.95 POL
  - 24.0% -> 1.00 POL
  - 5.0% -> 1.10 POL
  - 0.9% -> 3.00 POL
  - 0.1% -> 8.00 POL
- Antes de aceptar el spin, valida banca previa >= `8 POL` (premio máximo).

## Seguridad / notas

- Random actual es pseudo-random (apto solo MVP testnet): usa `prevrandao`, `timestamp`, `msg.sender`, `nonce`, `blockhash`.
- El contrato deja comentario y estructura preparada para reemplazo por Chainlink VRF en una fase siguiente.
- Pagos al jugador se hacen vía `call`.
- Owner puede `deposit` (o `receive`) y `withdraw` libremente.

## Estructura

```text
pol-slots-amoy/
  contracts/PolSlotsAmoy.sol
  scripts/deploy.js
  scripts/verify.js
  src/main.js
  src/style.css
  index.html
  hardhat.config.js
  vite.config.js
  package.json
  .env.example
  .gitignore
  README.md
```
