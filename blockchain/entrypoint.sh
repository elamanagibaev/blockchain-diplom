#!/usr/bin/env sh
set -e

echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 >/tmp/hardhat.log 2>&1 &
NODE_PID=$!

echo "Waiting for RPC..."
# Keep it dependency-free (no curl/wget in slim image). Hardhat usually starts within 2-5s.
sleep 4

echo "Deploying contract..."
npx hardhat run scripts/deploy.js --network localhost || true

echo "Hardhat ready. (PID $NODE_PID)"
wait $NODE_PID

