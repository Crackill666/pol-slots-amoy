// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PolSlotsAmoy is Ownable {
    uint256 public constant WAGER = 1e18; // 1 POL
    uint256 public constant MAX_PAYOUT = 30e18; // 30 POL

    // Probabilidades en basis points (10000 = 100%).
    uint16 private constant BP_LOSE = 3800; // 38.00%
    uint16 private constant BP_RETURN_100 = 3200; // 32.00%
    uint16 private constant BP_WIN_125 = 1600; // 16.00%
    uint16 private constant BP_WIN_200 = 850; // 8.50%
    uint16 private constant BP_WIN_300 = 350; // 3.50%
    uint16 private constant BP_WIN_500 = 150; // 1.50%
    uint16 private constant BP_WIN_1000 = 40; // 0.40%
    uint16 private constant BP_WIN_3000 = 10; // 0.10%

    uint256 public nonce;

    // outcomeCode:
    // 0 => 0.00 POL
    // 1 => 1.00 POL
    // 2 => 1.25 POL
    // 3 => 2.00 POL
    // 4 => 3.00 POL
    // 5 => 5.00 POL
    // 6 => 10.00 POL
    // 7 => 30.00 POL
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

        cursor += BP_RETURN_100;
        if (roll < cursor) {
            return (1, 1e18); // 1.00 POL
        }

        cursor += BP_WIN_125;
        if (roll < cursor) {
            return (2, 125e16); // 1.25 POL
        }

        cursor += BP_WIN_200;
        if (roll < cursor) {
            return (3, 2e18); // 2.00 POL
        }

        cursor += BP_WIN_300;
        if (roll < cursor) {
            return (4, 3e18); // 3.00 POL
        }

        cursor += BP_WIN_500;
        if (roll < cursor) {
            return (5, 5e18); // 5.00 POL
        }

        cursor += BP_WIN_1000;
        if (roll < cursor) {
            return (6, 10e18); // 10.00 POL
        }

        return (7, 30e18); // 30.00 POL
    }
}
