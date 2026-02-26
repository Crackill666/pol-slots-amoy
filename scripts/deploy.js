const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const contractFactory = await hre.ethers.getContractFactory("PolSlotsAmoy");
  const contract = await contractFactory.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const owner = await contract.owner();

  console.log("PolSlotsAmoy deployed to:", address);
  console.log("Owner:", owner);

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "PolSlotsAmoy.sol",
    "PolSlotsAmoy.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const frontendInfoPath = path.join(__dirname, "..", "src", "contract-info.json");
  const payload = {
    name: "PolSlotsAmoy",
    chainId: 80002,
    address,
    abi: artifact.abi
  };

  fs.writeFileSync(frontendInfoPath, JSON.stringify(payload, null, 2));
  console.log("Frontend contract info written to:", frontendInfoPath);

  console.log("\nSet this in .env / GitHub Secrets:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
