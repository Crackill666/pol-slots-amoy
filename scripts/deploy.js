const hre = require("hardhat");

async function main() {
  const contractFactory = await hre.ethers.getContractFactory("PolSlotsAmoy");
  const contract = await contractFactory.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PolSlotsAmoy deployed to:", address);
  console.log("Owner:", await contract.owner());

  console.log("\\nSugerencia .env frontend:");
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
