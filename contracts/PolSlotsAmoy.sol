// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PolSlotsAmoy is Ownable {
    uint256 public constant WAGER = 1e18; // 1 POL
    uint256 public constant JACKPOT_CONTRIBUTION = 1e17; // 0.1 POL
    uint256 public constant BANK_CONTRIBUTION = 9e17; // 0.9 POL
    uint256 public constant BASE_MAX_PAYOUT = 10e18; // x10 sobre 1 POL
    uint256 public constant BLOCK_SIZE = 100;

    // Probabilidades base en bps (10000 = 100.00%).
    uint16 private constant BP_X0 = 5690; // 56.9%
    uint16 private constant BP_X12 = 1780; // 17.8%
    uint16 private constant BP_X2 = 2050; // 20.5%
    uint16 private constant BP_X5 = 450; // 4.5%
    uint16 private constant BP_X10 = 30; // 0.3%

    // Multiplicadores en bps (10000 = 1.0x).
    uint32 private constant MULT_X0 = 0;
    uint32 private constant MULT_X12 = 12000;
    uint32 private constant MULT_X2 = 20000;
    uint32 private constant MULT_X5 = 50000;
    uint32 private constant MULT_X10 = 100000;

    uint256 public totalSpins;
    uint256 public spinsInBlock;
    uint256 public blockIndex;

    uint256 public bankBalance;
    uint256 public jackpotPool;

    uint256 private jackpotHitAt;

    event SpinResult(
        address indexed player,
        uint256 wager,
        uint32 outcomeMult,
        uint256 payout,
        bool isJackpot,
        uint256 jackpotPaid,
        uint256 jackpotPoolAfter
    );

    event JackpotHit(
        address indexed player,
        uint256 indexed blockIndex,
        uint256 spinInBlock,
        uint256 amount
    );

    event BankDeposited(address indexed by, uint256 amount, uint256 bankBalanceAfter);
    event BankWithdrawn(address indexed by, uint256 amount, uint256 bankBalanceAfter);
    event JackpotDeposited(address indexed by, uint256 amount, uint256 jackpotPoolAfter);
    event JackpotWithdrawn(address indexed by, uint256 amount, uint256 jackpotPoolAfter);

    error InvalidWager();
    error BankLow();
    error TransferFailed();
    error InsufficientBankBalance();
    error InsufficientJackpotPool();

    constructor() Ownable(msg.sender) {
        blockIndex = 1;
        jackpotHitAt = _pickJackpotHitAt(_rand(1));
    }

    receive() external payable {
        bankBalance += msg.value;
        emit BankDeposited(msg.sender, msg.value, bankBalance);
    }

    function deposit() external payable onlyOwner {
        bankBalance += msg.value;
        emit BankDeposited(msg.sender, msg.value, bankBalance);
    }

    function depositBank() external payable onlyOwner {
        bankBalance += msg.value;
        emit BankDeposited(msg.sender, msg.value, bankBalance);
    }

    function depositJackpot() external payable onlyOwner {
        jackpotPool += msg.value;
        emit JackpotDeposited(msg.sender, msg.value, jackpotPool);
    }

    function withdraw(uint256 amount) external onlyOwner {
        // Owner puede retirar 100% del bank en cualquier momento.
        _withdrawBank(amount);
    }

    function withdrawBank(uint256 amount) external onlyOwner {
        // Owner puede retirar 100% del bank en cualquier momento.
        _withdrawBank(amount);
    }

    function withdrawJackpot(uint256 amount) external onlyOwner {
        // Owner puede retirar 100% del jackpot en cualquier momento.
        if (amount > jackpotPool) {
            revert InsufficientJackpotPool();
        }

        jackpotPool -= amount;
        _transferOut(owner(), amount);
        emit JackpotWithdrawn(msg.sender, amount, jackpotPool);
    }

    function spin() external payable {
        if (msg.value != WAGER) {
            revert InvalidWager();
        }

        // Orden requerido:
        // 1) msg.value ya fue recibido
        // 2) sumar aporte al jackpot
        jackpotPool += JACKPOT_CONTRIBUTION;
        bankBalance += BANK_CONTRIBUTION;

        // 3) incrementar contador del bloque
        spinsInBlock += 1;
        totalSpins += 1;

        // 4) evaluar si cae jackpot
        bool isJackpot = spinsInBlock == jackpotHitAt;
        uint256 maxPayoutNow = isJackpot ? jackpotPool : BASE_MAX_PAYOUT;

        // Liquidez disponible para el spin actual.
        // Si no es jackpot, se reserva jackpotPool y la liquidez efectiva para slot base es el remanente.
        uint256 availableLiquidity = isJackpot ? address(this).balance : address(this).balance - jackpotPool;
        if (availableLiquidity < maxPayoutNow) {
            revert BankLow();
        }

        // 5) pagar y emitir eventos
        uint32 outcomeMult;
        uint256 payout;
        uint256 jackpotPaid;

        if (isJackpot) {
            jackpotPaid = jackpotPool;
            payout = jackpotPaid;
            jackpotPool = 0;

            _transferOut(msg.sender, payout);
            emit JackpotHit(msg.sender, blockIndex, spinsInBlock, jackpotPaid);
        } else {
            uint256 seed = _rand(totalSpins + 1000);
            outcomeMult = _resolveOutcomeMult(seed % 10000);
            if (outcomeMult > 0) {
                payout = (WAGER * outcomeMult) / 10000;
                bankBalance -= payout;
                _transferOut(msg.sender, payout);
            }
        }

        emit SpinResult(msg.sender, msg.value, outcomeMult, payout, isJackpot, jackpotPaid, jackpotPool);

        if (isJackpot || spinsInBlock == BLOCK_SIZE) {
            blockIndex += 1;
            spinsInBlock = 0;
            jackpotHitAt = _pickJackpotHitAt(_rand(totalSpins + 5000));
        }
    }

    function getJackpotPool() external view returns (uint256) {
        return jackpotPool;
    }

    function getSpinsInBlock() external view returns (uint256) {
        return spinsInBlock;
    }

    // Se restringe al owner para no exponer la posicion exacta al publico.
    function getJackpotHitAt() external view onlyOwner returns (uint256) {
        return jackpotHitAt;
    }

    function getState()
        external
        view
        returns (uint256 _bankBalance, uint256 _jackpotPool, uint256 _spinsInBlock, uint256 _blockIndex)
    {
        return (bankBalance, jackpotPool, spinsInBlock, blockIndex);
    }

    function _withdrawBank(uint256 amount) internal {
        if (amount > bankBalance) {
            revert InsufficientBankBalance();
        }

        bankBalance -= amount;
        _transferOut(owner(), amount);
        emit BankWithdrawn(msg.sender, amount, bankBalance);
    }

    function _resolveOutcomeMult(uint256 roll) internal pure returns (uint32) {
        uint256 cursor = BP_X0;
        if (roll < cursor) {
            return MULT_X0;
        }

        cursor += BP_X12;
        if (roll < cursor) {
            return MULT_X12;
        }

        cursor += BP_X2;
        if (roll < cursor) {
            return MULT_X2;
        }

        cursor += BP_X5;
        if (roll < cursor) {
            return MULT_X5;
        }

        return MULT_X10;
    }

    function _pickJackpotHitAt(uint256 seed) internal pure returns (uint256) {
        return (seed % BLOCK_SIZE) + 1;
    }

    // RNG pseudo-aleatorio util para testnet. No usar en produccion en lugar de VRF.
    function _rand(uint256 salt) internal view returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        blockhash(block.number - 1),
                        msg.sender,
                        address(this),
                        totalSpins,
                        spinsInBlock,
                        blockIndex,
                        salt
                    )
                )
            );
    }

    function _transferOut(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) {
            revert TransferFailed();
        }
    }
}
