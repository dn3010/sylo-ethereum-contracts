# Localhost Docker Image

This docker image runs a local ethereum node (foundry anvil) with the contracts
already deployed, 10 seekers minted to the deployer, and other
network params set to be ready for ticket redemption.

When the image is built, an `accounts.json`
used for the network and an `addresses.json` is stored in
`/app/deployment`.

The `addresses.json` is a JSON file listing out the deployed
contracts.

```json
{
  "deployer": "0x835dF5fE77D479695a616F79A3FC3a25310eb7c6",
  "syloToken": "0xc4db8fD3209c98290AB32693F5155c596B97Eabe",
  "authorizedAccounts": "0x4aa109E0DB0223ed2d9085679F450EfDf188CFf6",
  "registries": "0xa4dE4FEA5e961e5C130013CfE207f7C08148A73C",
  "protocolTimeManager": "0x7bFCE7796fdE3Ba0F2052959d506bdA480518edA",
  "syloStakingManager": "0x075EEeD1215982b78A2e05cD2213b5f53A718a9A",
  "stakingOrchestrator": "0xca7efb9aA54e70F7a8e7efb878A48BaefA34F4AC",
  "rewardsManager": "0x7E7C762176eaa1662d372399265760d4600CCf28",
  "directory": "0xBfF3a098eA52630351F8eE4C8DdfeA485869d543",
  "ticketing": "0x943E7031A7Ed0FC236173f05a3084104b81Aa480",
  "deposits": "0x07602c326dbD7Cd2E9124d0714e95bA1839446b1",
  "seekers": "0x49C537a88016186Ef41713239799Fc975F9e9aFA",
  "seekerStatsOracle": "0xFB87c433852Bb2917B37b0471DFA5B369e75083A",
  "futurepassRegistrar": "0x7DBf77bb534997892e5Bcfbdc79Dd82E71C35245"
}
```

Use volumes to feed the accounts or addresses to a local test or
another service.

The chain state is saved in a file `state.json`.

The `mnemonic` used to when starting the local anvil node and also
used to deploy the contracts is
`enroll regret dial tray life phrase saddle term friend figure meat add puppy explain soup`

Note: The context for building this image is in the root path of
this repository.

## Build docker

```sh
yarn docker-localhost
```

## Run docker

The options used to run the local ganache node should be set correctly
to ensure that it re-uses the same account used to deploy the contracts.

```sh
docker run --platform linux/amd64 -p 8545:8545 dn3010/sylo-ethereum-testnet:v2.0.0 --mnemonic "enroll regret dial tray life phrase saddle term friend figure meat add puppy explain soup"
```
