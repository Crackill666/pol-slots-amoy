const hre = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS in .env before verify.");
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
