// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PolSlotsAmoy is Ownable {
    uint256 public constant WAGER = 1e18; // 1 POL
    uint256 public constant MAX_PAYOUT = 8e18; // 8 POL

    // Probabilidades en basis points (10000 = 100%).
    uint16 private constant BP_LOSE = 1200; // 12.0%
    uint16 private constant BP_RETURN_095 = 5800; // 58.0%
    uint16 private constant BP_RETURN_100 = 2400; // 24.0%
    uint16 private constant BP_WIN_110 = 500; // 5.0%
    uint16 private constant BP_WIN_300 = 90; // 0.9%
    uint16 private constant BP_WIN_800 = 10; // 0.1%

    uint256 public nonce;

    // outcomeCode:
    // 0 => 0.00 POL
    // 1 => 0.95 POL
    // 2 => 1.00 POL
    // 3 => 1.10 POL
    // 4 => 3.00 POL
    // 5 => 8.00 POL
    event SpinResult(
        address indexed player,
        uint256 wager,
        uint256 payout,
        uint8 outcomeCode,
        uint256 randomSeed,
        uint256 timestamp
    );

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    error InvalidWager();
    error InsufficientBankBeforeSpin();
    error PayoutTransferFailed();

    constructor() Ownable(msg.sender) {}

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function deposit() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function spin() external payable {
        if (msg.value != WAGER) {
            revert InvalidWager();
        }

        // address(this).balance ya incluye msg.value.
        // Para exigir banca minima ANTES de aceptar la apuesta del jugador,
        // restamos msg.value y validamos el balance previo al spin.
        uint256 bankBeforeSpin = address(this).balance - msg.value;
        if (bankBeforeSpin < MAX_PAYOUT) {
            revert InsufficientBankBeforeSpin();
        }

        // Pseudo-random temporal para testnet.
        // TODO(VRF): reemplazar este seed por request/fulfillment de Chainlink VRF.
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    nonce,
                    blockhash(block.number - 1)
                )
            )
        );
        nonce++;

        (uint8 outcomeCode, uint256 payout) = _resolveOutcome(seed % 10000);

        if (payout > 0) {
            (bool ok, ) = payable(msg.sender).call{value: payout}("");
            if (!ok) {
                revert PayoutTransferFailed();
            }
        }

        emit SpinResult(msg.sender, msg.value, payout, outcomeCode, seed, block.timestamp);
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient contract balance");
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "Withdraw transfer failed");
        emit Withdraw(owner(), amount);
    }

    function _resolveOutcome(uint256 roll) internal pure returns (uint8 outcomeCode, uint256 payout) {
        uint256 cursor = BP_LOSE;
        if (roll < cursor) {
            return (0, 0);
        }

        cursor += BP_RETURN_095;
        if (roll < cursor) {
            return (1, 95e16); // 0.95 POL
        }

        cursor += BP_RETURN_100;
        if (roll < cursor) {
            return (2, 1e18); // 1.00 POL
        }

        cursor += BP_WIN_110;
        if (roll < cursor) {
            return (3, 11e17); // 1.10 POL
        }

        cursor += BP_WIN_300;
        if (roll < cursor) {
            return (4, 3e18); // 3.00 POL
        }

        // Resto: 0.1%
        return (5, 8e18); // 8.00 POL
    }
}
