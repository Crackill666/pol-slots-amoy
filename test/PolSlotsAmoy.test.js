const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PolSlotsAmoy - Jackpot blocks", function () {
  async function deployFixture() {
    const [owner, player] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PolSlotsAmoy");
    const slots = await Factory.deploy();
    await slots.waitForDeployment();
    return { slots, owner, player };
  }

  it("cuando cae jackpot, spinsInBlock se resetea a 0 e inicia bloque nuevo", async function () {
    const { slots, owner, player } = await deployFixture();

    await slots.connect(owner).depositBank({ value: ethers.parseEther("300") });

    let jackpotFound = false;
    let blockIndexBeforeHit = 0n;
    let blockIndexAfterHit = 0n;

    for (let i = 0; i < 150; i++) {
      const tx = await slots.connect(player).spin({ value: ethers.parseEther("1") });
      const receipt = await tx.wait();

      for (const log of receipt.logs) {
        let parsed;
        try {
          parsed = slots.interface.parseLog(log);
        } catch {
          continue;
        }

        if (parsed && parsed.name === "SpinResult" && parsed.args.isJackpot) {
          jackpotFound = true;
          blockIndexBeforeHit = await slots.blockIndex();
          const spinsAfterHit = await slots.getSpinsInBlock();
          expect(spinsAfterHit).to.equal(0);
          blockIndexAfterHit = await slots.blockIndex();
          expect(blockIndexAfterHit).to.equal(blockIndexBeforeHit);
          break;
        }
      }

      if (jackpotFound) {
        break;
      }
    }

    expect(jackpotFound).to.equal(true);
  });

  it("cuando cae jackpot, no paga premio normal y jackpotPoolAfter queda en 0", async function () {
    const { slots, owner, player } = await deployFixture();

    await slots.connect(owner).depositBank({ value: ethers.parseEther("300") });

    let jackpotSpin;

    for (let i = 0; i < 100 && !jackpotSpin; i++) {
      const tx = await slots.connect(player).spin({ value: ethers.parseEther("1") });
      const receipt = await tx.wait();

      for (const log of receipt.logs) {
        let parsed;
        try {
          parsed = slots.interface.parseLog(log);
        } catch {
          continue;
        }

        if (parsed && parsed.name === "SpinResult" && parsed.args.isJackpot) {
          jackpotSpin = parsed.args;
          break;
        }
      }
    }

    expect(jackpotSpin, "No hubo jackpot en 100 spins").to.exist;
    expect(jackpotSpin.isJackpot).to.equal(true);
    expect(jackpotSpin.outcomeMult).to.equal(0);
    expect(jackpotSpin.payout).to.equal(jackpotSpin.jackpotPaid);
    expect(jackpotSpin.jackpotPaid).to.be.gt(0);
    expect(jackpotSpin.jackpotPoolAfter).to.equal(0);
  });

  it("al caer jackpot incrementa blockIndex y define nuevo jackpotHitAt valido", async function () {
    const { slots, owner, player } = await deployFixture();

    await slots.connect(owner).depositBank({ value: ethers.parseEther("300") });

    const initialBlockIndex = await slots.blockIndex();

    let hitFound = false;
    for (let i = 0; i < 150; i++) {
      const tx = await slots.connect(player).spin({ value: ethers.parseEther("1") });
      const receipt = await tx.wait();

      for (const log of receipt.logs) {
        let parsed;
        try {
          parsed = slots.interface.parseLog(log);
        } catch {
          continue;
        }

        if (parsed && parsed.name === "SpinResult" && parsed.args.isJackpot) {
          hitFound = true;
          break;
        }
      }

      if (hitFound) {
        break;
      }
    }

    expect(hitFound).to.equal(true);

    const spinsInBlockAfter = await slots.getSpinsInBlock();
    const blockIndexAfter = await slots.blockIndex();
    const nextHitAt = await slots.connect(owner).getJackpotHitAt();

    expect(spinsInBlockAfter).to.equal(0);
    expect(blockIndexAfter).to.equal(initialBlockIndex + 1n);
    expect(nextHitAt).to.be.gte(1);
    expect(nextHitAt).to.be.lte(100);
  });

  it("BANK_LOW bloquea cuando no hay liquidez suficiente para max payout del proximo spin", async function () {
    const { slots, owner, player } = await deployFixture();

    const hitAt = Number(await slots.connect(owner).getJackpotHitAt());

    if (hitAt === 1) {
      await slots.connect(player).spin({ value: ethers.parseEther("1") });
    }

    await expect(slots.connect(player).spin({ value: ethers.parseEther("1") })).to.be.revertedWithCustomError(
      slots,
      "BankLow"
    );
  });

  it("owner puede retirar 100% de bank y jackpot en cualquier momento", async function () {
    const { slots, owner, player } = await deployFixture();

    await slots.connect(owner).depositBank({ value: ethers.parseEther("10") });
    await slots.connect(owner).depositJackpot({ value: ethers.parseEther("2") });

    // Forzamos estado de posible bloqueo para un jugador y aun asi owner debe poder vaciar.
    const hitAt = Number(await slots.connect(owner).getJackpotHitAt());
    for (let i = 0; i < hitAt; i++) {
      await slots.connect(player).spin({ value: ethers.parseEther("1") });
    }

    const [bankBefore, jackpotBefore] = await slots.getState();
    await slots.connect(owner).withdrawBank(bankBefore);
    await slots.connect(owner).withdrawJackpot(jackpotBefore);

    const [bankAfter, jackpotAfter] = await slots.getState();
    expect(bankAfter).to.equal(0);
    expect(jackpotAfter).to.equal(0);
  });
});
