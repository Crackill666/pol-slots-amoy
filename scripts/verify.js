const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    const frontendInfoPath = path.join(__dirname, "..", "src", "contract-info.json");
    if (fs.existsSync(frontendInfoPath)) {
      const parsed = JSON.parse(fs.readFileSync(frontendInfoPath, "utf8"));
      contractAddress = parsed.address;
    }
  }

  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS in .env or deploy first so src/contract-info.json exists.");
  }

  await hre.run("verify:verify", {
    address: contractAddress,
    constructorArguments: []
  });

  console.log("Verified:", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
