import "./style.css";
import { ethers } from "ethers";
import contractInfo from "./contract-info.json";

const AMOY_CHAIN_ID = 80002;
const AMOY_CHAIN_ID_HEX = "0x13882";
const AMOY_CHAIN_NAME = "Polygon Amoy";
const EXPLORER_TX = "https://amoy.polygonscan.com/tx/";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || contractInfo.address || "";
const AMOY_RPC_URL = import.meta.env.VITE_AMOY_RPC_URL || "";
const MIN_MAX_FEE_GWEI = import.meta.env.VITE_MIN_MAX_FEE_GWEI || "48.663500086";
const MIN_PRIORITY_FEE_GWEI = import.meta.env.VITE_MIN_PRIORITY_FEE_GWEI || "48.6635";
const SPIN_GAS_LIMIT = BigInt(import.meta.env.VITE_SPIN_GAS_LIMIT || "320000");

const ABI = contractInfo.abi?.length
  ? contractInfo.abi
  : [
      "function owner() view returns (address)",
      "function spin() payable",
      "function getState() view returns (uint256 bankBalance, uint256 jackpotPool, uint256 spinsInBlock, uint256 blockIndex)",
      "function getJackpotPool() view returns (uint256)",
      "function getSpinsInBlock() view returns (uint256)",
      "function depositBank() payable",
      "function withdrawBank(uint256 amount)",
      "function depositJackpot() payable",
      "function withdrawJackpot(uint256 amount)",
      "event SpinResult(address indexed player, uint256 wager, uint32 outcomeMult, uint256 payout, bool isJackpot, uint256 jackpotPaid, uint256 jackpotPoolAfter)"
    ];

const ui = {
  walletStatus: document.getElementById("walletStatus"),
  playerBalance: document.getElementById("playerBalance"),
  chainStatus: document.getElementById("chainStatus"),
  bankStatus: document.getElementById("bankStatus"),
  jackpotStatus: document.getElementById("jackpotStatus"),
  blockSpinsStatus: document.getElementById("blockSpinsStatus"),
  connectBtn: document.getElementById("connectBtn"),
  spinBtn: document.getElementById("spinBtn"),
  statusMsg: document.getElementById("statusMsg"),
  jackpotHitBanner: document.getElementById("jackpotHitBanner"),
  ownerPanel: document.getElementById("ownerPanel"),
  ownerInfo: document.getElementById("ownerInfo"),
  ownerStatus: document.getElementById("ownerStatus"),
  depositBankAmount: document.getElementById("depositBankAmount"),
  withdrawBankAmount: document.getElementById("withdrawBankAmount"),
  depositJackpotAmount: document.getElementById("depositJackpotAmount"),
  withdrawJackpotAmount: document.getElementById("withdrawJackpotAmount"),
  depositBankBtn: document.getElementById("depositBankBtn"),
  withdrawBankBtn: document.getElementById("withdrawBankBtn"),
  depositJackpotBtn: document.getElementById("depositJackpotBtn"),
  withdrawJackpotBtn: document.getElementById("withdrawJackpotBtn"),
  reels: document.getElementById("reels"),
  track1: document.getElementById("track1"),
  track2: document.getElementById("track2"),
  track3: document.getElementById("track3"),
  historyList: document.getElementById("historyList")
};

const icon = {
  cherry: String.fromCodePoint(0x1f352),
  lemon: String.fromCodePoint(0x1f34b),
  star: String.fromCodePoint(0x2b50),
  bell: String.fromCodePoint(0x1f514),
  gem: String.fromCodePoint(0x1f48e),
  crown: String.fromCodePoint(0x1f451),
  clover: String.fromCodePoint(0x1f340),
  dice: String.fromCodePoint(0x1f3b2),
  sparkles: String.fromCodePoint(0x2728),
  bolt: String.fromCodePoint(0x26a1),
  rocket: String.fromCodePoint(0x1f680),
  dart: String.fromCodePoint(0x1f3af),
  fire: String.fromCodePoint(0x1f525),
  slot: String.fromCodePoint(0x1f3b0)
};

const symbols = {
  low: [icon.cherry, icon.lemon],
  mid: [icon.star, icon.bell],
  high: ["7", icon.gem, icon.crown],
  misc: [icon.clover, icon.dice, icon.sparkles, icon.bolt, icon.rocket, icon.dart, icon.fire, icon.slot]
};

const DEFAULT_SYMBOL_HEIGHT_PX = 96;
const REEL_STRIP_REPEAT = 120;
const BASE_REPEAT_INDEX = 24;
const REEL_SYMBOLS = [...new Set([...symbols.low, ...symbols.mid, ...symbols.high, ...symbols.misc])];

let browserProvider;
let readProvider;
let signer;
let contract;
let userAddress = "";
let isSpinning = false;
const reelState = [];
const history = [];

function maxBigInt(a, b) {
  return a > b ? a : b;
}

async function buildSpinTxOverrides() {
  const minMaxFeePerGas = ethers.parseUnits(MIN_MAX_FEE_GWEI, "gwei");
  const minPriorityFeePerGas = ethers.parseUnits(MIN_PRIORITY_FEE_GWEI, "gwei");

  const feeData = await browserProvider.getFeeData();
  const suggestedMaxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  const suggestedPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? feeData.gasPrice;

  return {
    value: ethers.parseEther("1"),
    gasLimit: SPIN_GAS_LIMIT,
    maxFeePerGas: suggestedMaxFeePerGas
      ? maxBigInt(suggestedMaxFeePerGas, minMaxFeePerGas)
      : minMaxFeePerGas,
    maxPriorityFeePerGas: suggestedPriorityFeePerGas
      ? maxBigInt(suggestedPriorityFeePerGas, minPriorityFeePerGas)
      : minPriorityFeePerGas
  };
}

function formatPol(valueWei, digits = 2) {
  const value = Number(ethers.formatEther(valueWei));
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatPolCompact(valueWei, minDigits = 2, maxDigits = 4) {
  const value = Number(ethers.formatEther(valueWei));
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits
  });
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function normalizeAmountInput(value) {
  return String(value || "").trim().replace(",", ".");
}

function setMessage(text, mode = "") {
  ui.statusMsg.textContent = text;
  ui.statusMsg.classList.remove("status-pending", "status-win", "status-lose");
  if (mode) {
    ui.statusMsg.classList.add(mode);
  }
}

function setOwnerStatus(text, mode = "") {
  ui.ownerStatus.textContent = text;
  ui.ownerStatus.classList.remove("status-pending", "status-win", "status-lose");
  if (mode) {
    ui.ownerStatus.classList.add(mode);
  }
}

function setOwnerControlsDisabled(disabled) {
  ui.depositBankBtn.disabled = disabled;
  ui.withdrawBankBtn.disabled = disabled;
  ui.depositJackpotBtn.disabled = disabled;
  ui.withdrawJackpotBtn.disabled = disabled;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getSymbolHeightPx() {
  const reelWindowEl = document.querySelector(".reel-window");
  if (reelWindowEl && reelWindowEl.clientHeight > 0) {
    return reelWindowEl.clientHeight;
  }
  return DEFAULT_SYMBOL_HEIGHT_PX;
}

function symbolIndex(symbol) {
  const index = REEL_SYMBOLS.indexOf(symbol);
  return index === -1 ? 0 : index;
}

function rowForSymbol(symbol, repeatIndex = BASE_REPEAT_INDEX) {
  return repeatIndex * REEL_SYMBOLS.length + symbolIndex(symbol);
}

function modulo(value, base) {
  return ((value % base) + base) % base;
}

function wrapSpinPosition(position, symbolHeight) {
  const cycleRows = REEL_SYMBOLS.length;
  const cycleHeight = cycleRows * symbolHeight;
  const minSafeRows = cycleRows * 8;
  const maxSafeRows = cycleRows * (REEL_STRIP_REPEAT - 8);
  const row = Math.floor(position / symbolHeight);

  if (row < minSafeRows || row > maxSafeRows) {
    const offsetInCycle = modulo(position, cycleHeight);
    return BASE_REPEAT_INDEX * cycleHeight + offsetInCycle;
  }

  return position;
}

function normalizedRowForStop(position, symbolHeight) {
  const cycleRows = REEL_SYMBOLS.length;
  const currentRow = Math.floor(position / symbolHeight);
  return BASE_REPEAT_INDEX * cycleRows + modulo(currentRow, cycleRows);
}

function setTrackPosition(state, position) {
  state.position = position;
  state.track.style.transform = `translateY(-${Math.round(position)}px)`;
}

function initReels() {
  const tracks = [ui.track1, ui.track2, ui.track3].filter(Boolean);
  if (tracks.length !== 3) {
    return;
  }

  reelState.length = 0;

  tracks.forEach((track, index) => {
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < REEL_STRIP_REPEAT; r++) {
      for (const symbol of REEL_SYMBOLS) {
        const item = document.createElement("span");
        item.className = "reel-symbol";
        item.textContent = symbol;
        fragment.appendChild(item);
      }
    }

    track.innerHTML = "";
    track.appendChild(fragment);

    const state = {
      track,
      position: 0,
      speed: 24 + index * 4,
      timer: null
    };

    track.style.transition = "none";
    setTrackPosition(state, rowForSymbol(icon.slot) * getSymbolHeightPx());
    reelState.push(state);
  });
}

function setReels(a, b, c) {
  const symbolsToShow = [a, b, c];
  reelState.forEach((state, index) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.track.style.transition = "none";
    setTrackPosition(state, rowForSymbol(symbolsToShow[index]) * getSymbolHeightPx());
  });
}

function buildReelCombo(isJackpot, multBps) {
  if (isJackpot) {
    return [icon.crown, icon.crown, icon.crown];
  }

  if (multBps === 0) {
    const picks = [...symbols.misc].sort(() => Math.random() - 0.5).slice(0, 3);
    return picks;
  }

  if (multBps === 12000) {
    const same = randomFrom([...symbols.low, ...symbols.misc]);
    let diff = randomFrom([...symbols.mid, ...symbols.high, ...symbols.misc]);
    while (diff === same) {
      diff = randomFrom([...symbols.mid, ...symbols.high, ...symbols.misc]);
    }
    return [same, same, diff].sort(() => Math.random() - 0.5);
  }

  if (multBps === 20000) {
    const s = randomFrom(symbols.low);
    return [s, s, s];
  }

  if (multBps === 50000) {
    const s = randomFrom(symbols.mid);
    return [s, s, s];
  }

  return [icon.gem, icon.gem, icon.gem];
}

function startSpinning() {
  if (isSpinning) {
    return;
  }

  isSpinning = true;
  ui.reels.classList.add("spinning");

  reelState.forEach((state) => {
    state.track.style.transition = "none";
    if (state.timer) {
      clearInterval(state.timer);
    }
    state.timer = setInterval(() => {
      const symbolHeight = getSymbolHeightPx();
      const nextPosition = wrapSpinPosition(state.position + state.speed, symbolHeight);
      setTrackPosition(state, nextPosition);
    }, 33);
  });
}

function stopSpinningImmediately() {
  isSpinning = false;
  ui.reels.classList.remove("spinning");

  reelState.forEach((state) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.track.style.transition = "none";
  });
}

function stopSpinningAt(combo) {
  isSpinning = false;
  ui.reels.classList.remove("spinning");

  return Promise.all(
    reelState.map((state, index) => {
      return new Promise((resolve) => {
        const delayMs = index * 220;
        const durationMs = 900 + index * 260;

        setTimeout(() => {
          if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
          }

          const symbolHeight = getSymbolHeightPx();
          const currentRow = normalizedRowForStop(state.position, symbolHeight);
          const minAdvanceRows = REEL_SYMBOLS.length * (4 - index);
          let targetRow = currentRow + minAdvanceRows;
          const targetIndex = symbolIndex(combo[index]);

          while (targetRow % REEL_SYMBOLS.length !== targetIndex) {
            targetRow += 1;
          }

          state.track.style.transition = `transform ${durationMs}ms cubic-bezier(0.12, 0.75, 0.2, 1)`;
          setTrackPosition(state, targetRow * symbolHeight);

          setTimeout(() => {
            state.track.style.transition = "none";
            resolve();
          }, durationMs + 30);
        }, delayMs);
      });
    })
  );
}

function showJackpotHit(amountWei) {
  ui.jackpotHitBanner.textContent = `JACKPOT HIT! ${formatPolCompact(amountWei)} POL`;
  ui.jackpotHitBanner.classList.remove("hidden");
  ui.reels.classList.add("jackpot-flash");
  setTimeout(() => {
    ui.jackpotHitBanner.classList.add("hidden");
    ui.reels.classList.remove("jackpot-flash");
  }, 2600);
}

function renderHistory() {
  if (history.length === 0) {
    ui.historyList.innerHTML = '<li class="empty-history">Sin tiradas todavia.</li>';
    return;
  }

  ui.historyList.innerHTML = history
    .map((item) => {
      return `<li class="history-item">${item.message} | payout: ${item.payout} POL | <a class="tx-link" target="_blank" rel="noreferrer" href="${EXPLORER_TX}${item.hash}">${item.hashShort}</a></li>`;
    })
    .join("");
}

async function updateOnchainState(providerToUse) {
  if (!CONTRACT_ADDRESS || !providerToUse) {
    ui.bankStatus.textContent = "Bank: configura VITE_CONTRACT_ADDRESS";
    ui.jackpotStatus.textContent = "JACKPOT ACUMULADO: - POL";
    ui.blockSpinsStatus.textContent = "Spins del bloque: -/100";
    return;
  }

  try {
    const readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, providerToUse);
    const [bankBalance, jackpotPool, spinsInBlock] = await readContract.getState();

    ui.bankStatus.textContent = `Bank: ${formatPol(bankBalance)} POL`;
    ui.jackpotStatus.textContent = `JACKPOT ACUMULADO: ${formatPolCompact(jackpotPool)} POL`;
    ui.blockSpinsStatus.textContent = `Spins del bloque: ${spinsInBlock}/100`;
  } catch {
    ui.bankStatus.textContent = "Bank: error al leer estado";
    ui.jackpotStatus.textContent = "JACKPOT ACUMULADO: error";
    ui.blockSpinsStatus.textContent = "Spins del bloque: error";
  }
}

async function updatePlayerBalance(providerToUse) {
  if (!userAddress) {
    ui.playerBalance.textContent = "Saldo wallet: - POL";
    return;
  }

  try {
    const walletBalance = await providerToUse.getBalance(userAddress);
    ui.playerBalance.textContent = `Saldo wallet: ${formatPol(walletBalance)} POL`;
  } catch {
    ui.playerBalance.textContent = "Saldo wallet: error al leer balance";
  }
}

async function ensureAmoyNetwork() {
  const network = await browserProvider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId === AMOY_CHAIN_ID) {
    ui.chainStatus.textContent = `Red: ${AMOY_CHAIN_NAME} (${AMOY_CHAIN_ID})`;
    return true;
  }

  ui.chainStatus.textContent = `Red: incorrecta (${chainId})`;
  setMessage("Cambia a Polygon Amoy para jugar.", "status-pending");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AMOY_CHAIN_ID_HEX }]
    });
    ui.chainStatus.textContent = `Red: ${AMOY_CHAIN_NAME} (${AMOY_CHAIN_ID})`;
    return true;
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: AMOY_CHAIN_ID_HEX,
            chainName: AMOY_CHAIN_NAME,
            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
            rpcUrls: [AMOY_RPC_URL || "https://rpc-amoy.polygon.technology"],
            blockExplorerUrls: ["https://amoy.polygonscan.com"]
          }
        ]
      });
      return true;
    }
    return false;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    setMessage("Instala MetaMask para jugar.", "status-lose");
    return;
  }

  if (!CONTRACT_ADDRESS) {
    setMessage("Falta VITE_CONTRACT_ADDRESS o src/contract-info.json", "status-lose");
    return;
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts.length) {
    return;
  }

  signer = await browserProvider.getSigner();
  userAddress = await signer.getAddress();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  ui.walletStatus.textContent = `Wallet: ${shortAddress(userAddress)}`;

  const onRightNetwork = await ensureAmoyNetwork();
  ui.spinBtn.disabled = !onRightNetwork;

  if (onRightNetwork) {
    setMessage("Listo para jugar. Cada spin cuesta 1 POL.");
  }

  try {
    const ownerAddress = await contract.owner();
    if (ownerAddress.toLowerCase() === userAddress.toLowerCase()) {
      ui.ownerPanel.classList.remove("hidden");
      ui.ownerInfo.textContent = `Owner conectado: ${shortAddress(ownerAddress)}`;
      setOwnerStatus("Panel owner habilitado.");
    } else {
      ui.ownerPanel.classList.add("hidden");
    }
  } catch {
    ui.ownerPanel.classList.add("hidden");
  }

  await updateOnchainState(browserProvider);
  await updatePlayerBalance(browserProvider);
}

function resultMessage(isJackpot, outcomeMult, payoutWei, jackpotPaidWei) {
  if (isJackpot) {
    return `JACKPOT HIT! ${formatPolCompact(jackpotPaidWei)} POL`;
  }

  const payout = formatPol(payoutWei);
  if (outcomeMult === 0) {
    return "Perdiste";
  }
  if (outcomeMult === 12000) {
    return `Ganaste ${payout} POL (x1,2)`;
  }
  if (outcomeMult === 20000) {
    return `Ganaste ${payout} POL (x2)`;
  }
  if (outcomeMult === 50000) {
    return `Ganaste ${payout} POL (x5)`;
  }
  return `MEGA WIN ${payout} POL (x10)`;
}

async function doSpin() {
  if (!contract || !signer) {
    return;
  }

  const onRightNetwork = await ensureAmoyNetwork();
  if (!onRightNetwork) {
    ui.spinBtn.disabled = true;
    return;
  }

  ui.spinBtn.disabled = true;
  setMessage("Confirma en tu wallet...", "status-pending");

  try {
    const txOverrides = await buildSpinTxOverrides();
    const tx = await contract.spin(txOverrides);

    setMessage("Transaccion pendiente...", "status-pending");
    startSpinning();

    const receipt = await tx.wait();
    const iface = new ethers.Interface(ABI);

    let spinParsed;
    for (const log of receipt.logs) {
      try {
        const decoded = iface.parseLog(log);
        if (decoded && decoded.name === "SpinResult") {
          spinParsed = decoded.args;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!spinParsed) {
      throw new Error("No se encontro evento SpinResult en receipt.");
    }

    const isJackpot = Boolean(spinParsed.isJackpot);
    const outcomeMult = Number(spinParsed.outcomeMult);
    const payout = spinParsed.payout;
    const jackpotPaid = spinParsed.jackpotPaid;

    const combo = buildReelCombo(isJackpot, outcomeMult);
    await stopSpinningAt(combo);

    const msg = resultMessage(isJackpot, outcomeMult, payout, jackpotPaid);
    setMessage(msg, isJackpot || payout > 0 ? "status-win" : "status-lose");

    if (isJackpot) {
      showJackpotHit(jackpotPaid);
    }

    history.unshift({
      message: msg,
      payout: formatPolCompact(payout),
      hash: receipt.hash,
      hashShort: shortHash(receipt.hash)
    });
    history.splice(5);
    renderHistory();

    await updateOnchainState(browserProvider);
    await updatePlayerBalance(browserProvider);
  } catch (error) {
    stopSpinningImmediately();
    const reason = error?.shortMessage || error?.reason || error?.message || "Error en spin";
    setMessage(reason, "status-lose");
  } finally {
    ui.spinBtn.disabled = false;
  }
}

async function ownerAction(amountInputEl, actionFn, pendingText, successText) {
  if (!contract || !signer) {
    setOwnerStatus("Conecta wallet owner primero.", "status-lose");
    return;
  }

  try {
    const amountText = normalizeAmountInput(amountInputEl.value);
    const amountWei = ethers.parseEther(amountText);
    if (amountWei <= 0n) {
      throw new Error("Monto invalido");
    }

    setOwnerControlsDisabled(true);
    setOwnerStatus(pendingText, "status-pending");

    const tx = await actionFn(amountWei);
    setOwnerStatus("Transaccion pendiente...", "status-pending");
    await tx.wait();

    setOwnerStatus(`${successText}: ${amountText} POL`, "status-win");
    await updateOnchainState(browserProvider);
    await updatePlayerBalance(browserProvider);
  } catch (error) {
    const reason = error?.shortMessage || error?.reason || error?.message || "Error owner";
    setOwnerStatus(reason, "status-lose");
  } finally {
    setOwnerControlsDisabled(false);
  }
}

function installWalletListeners() {
  if (!window.ethereum) {
    return;
  }

  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}

async function bootstrapReadOnlyState() {
  if (!CONTRACT_ADDRESS || !AMOY_RPC_URL) {
    ui.chainStatus.textContent = `Red esperada: ${AMOY_CHAIN_NAME} (${AMOY_CHAIN_ID})`;
    return;
  }

  readProvider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  await updateOnchainState(readProvider);
  ui.chainStatus.textContent = `Red esperada: ${AMOY_CHAIN_NAME} (${AMOY_CHAIN_ID})`;
}

ui.connectBtn.addEventListener("click", connectWallet);
ui.spinBtn.addEventListener("click", doSpin);
ui.depositBankBtn.addEventListener("click", () =>
  ownerAction(
    ui.depositBankAmount,
    (amountWei) => contract.depositBank({ value: amountWei }),
    "Confirma deposito de bank...",
    "Deposito bank confirmado"
  )
);
ui.withdrawBankBtn.addEventListener("click", () =>
  ownerAction(
    ui.withdrawBankAmount,
    (amountWei) => contract.withdrawBank(amountWei),
    "Confirma retiro de bank...",
    "Retiro bank confirmado"
  )
);
ui.depositJackpotBtn.addEventListener("click", () =>
  ownerAction(
    ui.depositJackpotAmount,
    (amountWei) => contract.depositJackpot({ value: amountWei }),
    "Confirma deposito de jackpot...",
    "Deposito jackpot confirmado"
  )
);
ui.withdrawJackpotBtn.addEventListener("click", () =>
  ownerAction(
    ui.withdrawJackpotAmount,
    (amountWei) => contract.withdrawJackpot(amountWei),
    "Confirma retiro de jackpot...",
    "Retiro jackpot confirmado"
  )
);

initReels();
setReels(icon.slot, icon.slot, icon.slot);
renderHistory();
installWalletListeners();
bootstrapReadOnlyState();
