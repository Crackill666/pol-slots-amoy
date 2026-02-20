import "./style.css";
import { ethers } from "ethers";

const AMOY_CHAIN_ID = 80002;
const AMOY_CHAIN_ID_HEX = "0x13882";
const AMOY_CHAIN_NAME = "Polygon Amoy";
const EXPLORER_TX = "https://amoy.polygonscan.com/tx/";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const AMOY_RPC_URL = import.meta.env.VITE_AMOY_RPC_URL || "";
const MIN_MAX_FEE_GWEI = import.meta.env.VITE_MIN_MAX_FEE_GWEI || "48.663500086";
const MIN_PRIORITY_FEE_GWEI = import.meta.env.VITE_MIN_PRIORITY_FEE_GWEI || "48.6635";
const SPIN_GAS_LIMIT = BigInt(import.meta.env.VITE_SPIN_GAS_LIMIT || "300000");

const ABI = [
  "function spin() payable",
  "function owner() view returns (address)",
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function WAGER() view returns (uint256)",
  "function MAX_PAYOUT() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "event SpinResult(address indexed player, uint256 wager, uint256 payout, uint8 outcomeCode, uint256 randomSeed, uint256 timestamp)"
];

const ui = {
  walletStatus: document.getElementById("walletStatus"),
  chainStatus: document.getElementById("chainStatus"),
  bankStatus: document.getElementById("bankStatus"),
  connectBtn: document.getElementById("connectBtn"),
  spinBtn: document.getElementById("spinBtn"),
  statusMsg: document.getElementById("statusMsg"),
  ownerPanel: document.getElementById("ownerPanel"),
  ownerInfo: document.getElementById("ownerInfo"),
  ownerStatus: document.getElementById("ownerStatus"),
  depositAmount: document.getElementById("depositAmount"),
  withdrawAmount: document.getElementById("withdrawAmount"),
  depositBtn: document.getElementById("depositBtn"),
  withdrawBtn: document.getElementById("withdrawBtn"),
  reels: document.getElementById("reels"),
  reel1: document.getElementById("reel1"),
  reel2: document.getElementById("reel2"),
  reel3: document.getElementById("reel3"),
  historyList: document.getElementById("historyList")
};

const symbols = {
  low: ["🍒", "🍋"],
  mid: ["⭐", "🔔"],
  high: ["💎", "7", "👑"],
  misc: ["🍀", "🎲", "🪙", "💠", "⚡", "🛰️", "🛸", "🧿"]
};

const outcomeMessage = {
  0: "Perdiste",
  1: "Recuperaste 0,95 POL",
  2: "Empate - 1,00 POL",
  3: "¡Ganaste 1,10 POL!",
  4: "¡Ganaste 3,00 POL!",
  5: "🎉 ¡GRAN PREMIO! 8,00 POL"
};

let browserProvider;
let readProvider;
let signer;
let contract;
let userAddress = "";
let spinTimer;
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

function formatPol(valueWei) {
  const value = Number(ethers.formatEther(valueWei));
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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

function setOwnerStatus(text, mode = "") {
  ui.ownerStatus.textContent = text;
  ui.ownerStatus.classList.remove("status-pending", "status-win", "status-lose");
  if (mode) {
    ui.ownerStatus.classList.add(mode);
  }
}

function setOwnerControlsDisabled(disabled) {
  ui.depositBtn.disabled = disabled;
  ui.withdrawBtn.disabled = disabled;
}

function setMessage(text, mode = "") {
  ui.statusMsg.textContent = text;
  ui.statusMsg.classList.remove("status-pending", "status-win", "status-lose");
  if (mode) {
    ui.statusMsg.classList.add(mode);
  }
}

function setReels(a, b, c) {
  ui.reel1.textContent = a;
  ui.reel2.textContent = b;
  ui.reel3.textContent = c;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildReelCombo(outcomeCode) {
  if (outcomeCode === 0) {
    const picks = [...symbols.misc].sort(() => Math.random() - 0.5).slice(0, 3);
    return picks;
  }

  if (outcomeCode === 1 || outcomeCode === 2) {
    const same = randomFrom([...symbols.low, ...symbols.misc]);
    let diff = randomFrom([...symbols.mid, ...symbols.misc, ...symbols.high]);
    while (diff === same) {
      diff = randomFrom([...symbols.mid, ...symbols.misc, ...symbols.high]);
    }
    return [same, same, diff].sort(() => Math.random() - 0.5);
  }

  if (outcomeCode === 3) {
    const low = randomFrom(symbols.low);
    return [low, low, low];
  }

  if (outcomeCode === 4) {
    const mid = randomFrom(symbols.mid);
    return [mid, mid, mid];
  }

  const high = randomFrom(symbols.high);
  return [high, high, high];
}

function startSpinning() {
  ui.reels.classList.add("spinning");
  const all = [...symbols.low, ...symbols.mid, ...symbols.high, ...symbols.misc];
  spinTimer = setInterval(() => {
    setReels(randomFrom(all), randomFrom(all), randomFrom(all));
  }, 80);
}

function stopSpinning() {
  clearInterval(spinTimer);
  ui.reels.classList.remove("spinning");
}

function throwConfetti() {
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = Math.random() > 0.5 ? "#31d8ff" : "#ff3ea5";
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1500);
  }
}

function renderHistory() {
  if (history.length === 0) {
    ui.historyList.innerHTML = '<li class="empty-history">Sin tiradas todavía.</li>';
    return;
  }

  ui.historyList.innerHTML = history
    .map((item) => {
      return `<li class="history-item">${item.message} | payout: ${item.payout} POL | <a class="tx-link" target="_blank" rel="noreferrer" href="${EXPLORER_TX}${item.hash}">${item.hashShort}</a></li>`;
    })
    .join("");
}

async function updateBankBalance(providerToUse) {
  if (!CONTRACT_ADDRESS) {
    ui.bankStatus.textContent = "Bank: configurá VITE_CONTRACT_ADDRESS";
    return;
  }

  try {
    const bank = await providerToUse.getBalance(CONTRACT_ADDRESS);
    ui.bankStatus.textContent = `Bank: ${formatPol(bank)} POL`;
  } catch {
    ui.bankStatus.textContent = "Bank: error al leer balance";
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
  setMessage("Cambiá a Polygon Amoy para jugar.", "status-pending");

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
    setMessage("Instalá MetaMask para jugar.", "status-lose");
    return;
  }

  if (!CONTRACT_ADDRESS) {
    setMessage("Falta VITE_CONTRACT_ADDRESS en .env", "status-lose");
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
    const isOwner = ownerAddress.toLowerCase() === userAddress.toLowerCase();
    if (isOwner) {
      ui.ownerPanel.classList.remove("hidden");
      ui.ownerInfo.textContent = `Owner conectado: ${shortAddress(ownerAddress)}`;
      setOwnerStatus("Panel owner habilitado.");
    } else {
      ui.ownerPanel.classList.add("hidden");
    }
  } catch {
    ui.ownerPanel.classList.add("hidden");
  }

  await updateBankBalance(browserProvider);
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
  setMessage("Confirmá en tu wallet...", "status-pending");

  try {
    const txOverrides = await buildSpinTxOverrides();
    const tx = await contract.spin(txOverrides);

    setMessage("Transacción pendiente...", "status-pending");
    startSpinning();

    const receipt = await tx.wait();

    const iface = new ethers.Interface(ABI);
    let parsed;
    for (const log of receipt.logs) {
      try {
        const decoded = iface.parseLog(log);
        if (decoded && decoded.name === "SpinResult") {
          parsed = decoded.args;
          break;
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }

    if (!parsed) {
      throw new Error("No se encontró evento SpinResult en receipt.");
    }

    const outcomeCode = Number(parsed.outcomeCode);
    const payout = parsed.payout;

    stopSpinning();
    const [a, b, c] = buildReelCombo(outcomeCode);
    setReels(a, b, c);

    const msg = outcomeMessage[outcomeCode] || "Spin confirmado";
    const mode = outcomeCode === 0 ? "status-lose" : "status-win";
    setMessage(msg, mode);

    if (outcomeCode === 5) {
      ui.reels.classList.add("jackpot-flash");
      throwConfetti();
      setTimeout(() => ui.reels.classList.remove("jackpot-flash"), 2300);
    }

    history.unshift({
      message: msg,
      payout: formatPol(payout),
      hash: receipt.hash,
      hashShort: shortHash(receipt.hash)
    });
    history.splice(5);
    renderHistory();

    await updateBankBalance(browserProvider);
  } catch (error) {
    stopSpinning();

    const reason = error?.shortMessage || error?.reason || error?.message || "Error en spin";
    setMessage(reason, "status-lose");
  } finally {
    ui.spinBtn.disabled = false;
  }
}

function installWalletListeners() {
  if (!window.ethereum) {
    return;
  }

  window.ethereum.on("accountsChanged", () => {
    window.location.reload();
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}

async function bootstrapReadOnlyState() {
  if (!CONTRACT_ADDRESS || !AMOY_RPC_URL) {
    return;
  }

  readProvider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  await updateBankBalance(readProvider);
  ui.chainStatus.textContent = `Red esperada: ${AMOY_CHAIN_NAME} (${AMOY_CHAIN_ID})`;
}

async function handleDeposit() {
  if (!contract || !signer) {
    setOwnerStatus("Conecta wallet owner primero.", "status-lose");
    return;
  }

  try {
    const amountText = normalizeAmountInput(ui.depositAmount.value);
    const amountWei = ethers.parseEther(amountText);
    if (amountWei <= 0n) {
      throw new Error("Monto invalido");
    }

    setOwnerControlsDisabled(true);
    setOwnerStatus("Confirma deposito en tu wallet...", "status-pending");
    const tx = await contract.deposit({ value: amountWei });
    setOwnerStatus("Deposito pendiente...", "status-pending");
    await tx.wait();
    setOwnerStatus(`Deposito confirmado: ${amountText} POL`, "status-win");
    await updateBankBalance(browserProvider);
  } catch (error) {
    const reason = error?.shortMessage || error?.reason || error?.message || "Error en deposito";
    setOwnerStatus(reason, "status-lose");
  } finally {
    setOwnerControlsDisabled(false);
  }
}

async function handleWithdraw() {
  if (!contract || !signer) {
    setOwnerStatus("Conecta wallet owner primero.", "status-lose");
    return;
  }

  try {
    const amountText = normalizeAmountInput(ui.withdrawAmount.value);
    const amountWei = ethers.parseEther(amountText);
    if (amountWei <= 0n) {
      throw new Error("Monto invalido");
    }

    setOwnerControlsDisabled(true);
    setOwnerStatus("Confirma retiro en tu wallet...", "status-pending");
    const tx = await contract.withdraw(amountWei);
    setOwnerStatus("Retiro pendiente...", "status-pending");
    await tx.wait();
    setOwnerStatus(`Retiro confirmado: ${amountText} POL`, "status-win");
    await updateBankBalance(browserProvider);
  } catch (error) {
    const reason = error?.shortMessage || error?.reason || error?.message || "Error en retiro";
    setOwnerStatus(reason, "status-lose");
  } finally {
    setOwnerControlsDisabled(false);
  }
}

ui.connectBtn.addEventListener("click", connectWallet);
ui.spinBtn.addEventListener("click", doSpin);
ui.depositBtn.addEventListener("click", handleDeposit);
ui.withdrawBtn.addEventListener("click", handleWithdraw);

setReels("🎰", "🎰", "🎰");
renderHistory();
installWalletListeners();
bootstrapReadOnlyState();
