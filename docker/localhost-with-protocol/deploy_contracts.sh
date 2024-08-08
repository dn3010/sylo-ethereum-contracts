#!/bin/bash

set -e

echo "starting local node"
anvil \
  --state state.json \
  --mnemonic "enroll regret dial tray life phrase saddle term friend figure meat add puppy explain soup" \
  --block-time 1 \
  &>/dev/null &

anvil_pid=`echo $!`

sleep 15

echo "deploying contracts to local node"
npx hardhat --network localhost deploy
cp ./deployments/localhost_deployment_phase_two.json deployment/addresses.json

echo "initialzing network"
npx hardhat --network localhost run scripts/init_local_network.ts

kill $anvil_pid
sleep 10
echo "deployment complete"
