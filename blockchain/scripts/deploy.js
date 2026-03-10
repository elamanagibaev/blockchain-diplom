const fs = require("fs");
const path = require("path");

async function main() {
  const FileRegistry = await ethers.getContractFactory("FileRegistry");
  const contract = await FileRegistry.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("FileRegistry deployed to:", address);

  const artifactsPath = path.join(
    __dirname,
    "../artifacts/contracts/FileRegistry.sol/FileRegistry.json"
  );
  const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
  const abi = artifacts.abi;

  // Write address + ABI to shared volume for backend auto-config
  const sharedDir = "/shared";
  try {
    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(path.join(sharedDir, "contract_address.txt"), `${address}\n`, "utf8");
    fs.writeFileSync(path.join(sharedDir, "FileRegistry.abi.json"), JSON.stringify(abi, null, 2), "utf8");
  } catch (e) {
    console.warn("Could not write to /shared:", e.message);
  }

  // Also copy ABI into backend folder (useful when developing without Docker volume)
  const backendAbiDir = path.join(__dirname, "../../backend/app/blockchain/abi");
  if (!fs.existsSync(backendAbiDir)) fs.mkdirSync(backendAbiDir, { recursive: true });
  fs.writeFileSync(
    path.join(backendAbiDir, "FileRegistry.json"),
    JSON.stringify(abi, null, 2),
    "utf8"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

