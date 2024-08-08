import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  DeployFunction,
  DeployOptions,
  DeployResult,
  Receipt,
  TxOptions,
} from 'hardhat-deploy/types';
import path from 'path';
import * as fs from 'fs/promises';
import { ethers, network } from 'hardhat';
import * as configs from '../deployments/genesis.config';
import { FixedContractNames } from '../common/contracts';
import { main } from '../scripts/init_local_network';

export const DeployedContractNames = {
  syloStakingManager: 'SyloStakingManager',
  seekerStatsOracle: 'SeekerStatsOracle',
  seekerStakingManager: 'SeekerStakingManager',
  stakingOrchestrator: 'StakingOrchestrator',
  protocolTimeManager: 'ProtocolTimeManager',
  registries: 'Registries',
  directory: 'Directory',
  authorizedAccounts: 'AuthorizedAccounts',
  rewardsManager: 'RewardsManager',
  ticketing: 'Ticketing',
  deposits: 'Deposits',
};

export const ContractNames = {
  ...FixedContractNames,
  ...DeployedContractNames,
};

type ContractParams = {
  name: string;
  args: unknown[];
};

type ContractMap = {
  [key: string]: DeployResult;
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const deploy = hre.deployments.deploy.bind(hre.deployments);
  const execute = hre.deployments.execute.bind(hre.deployments);

  const config = getConfig(network.name);

  const contracts: ContractMap = {};

  console.log(
    `Deploying Sylo Protocol Contracts with deployer: ${deployer.address}...`,
  );

  // DEPLOY CONTRACTS
  if (config.SyloToken == '') {
    config.SyloToken = (
      await deployContract('SyloToken', deployer.address, false, deploy)
    ).address;
  }
  if (config.Seekers == '') {
    config.Seekers = (
      await deployContract('TestSeekers', deployer.address, false, deploy)
    ).address;
  }
  if (config.FuturepassRegistrar == '') {
    config.FuturepassRegistrar = (
      await deployContract(
        'TestFuturepassRegistrar',
        deployer.address,
        false,
        deploy,
      )
    ).address;
  }

  for (const name of Object.values(DeployedContractNames)) {
    contracts[name] = await deployContract(
      name,
      deployer.address,
      true,
      deploy,
    );
  }

  const statsOracle = config.SeekerStatsOracle.oracle ?? deployer.address;

  // INITIALIZE CONTRACTS
  const initializeParams: ContractParams[] = [
    {
      name: ContractNames.authorizedAccounts,
      args: [],
    },
    {
      name: ContractNames.registries,
      args: [config.Registries.defaultPayoutPercentage],
    },
    {
      name: ContractNames.directory,
      args: [
        contracts[ContractNames.stakingOrchestrator].address,
        contracts[ContractNames.protocolTimeManager].address,
      ],
    },
    {
      name: ContractNames.protocolTimeManager,
      args: [
        config.ProtocolTimeManager.cycleDuration,
        config.ProtocolTimeManager.periodDuration,
      ],
    },

    // payments
    {
      name: ContractNames.ticketing,
      args: [
        contracts[ContractNames.deposits].address,
        contracts[ContractNames.registries].address,
        contracts[ContractNames.rewardsManager].address,
        contracts[ContractNames.authorizedAccounts].address,
        config.FuturepassRegistrar,
        config.Ticketing.faceValue,
        config.Ticketing.multiReceiverFaceValue,
        config.Ticketing.baseLiveWinProb,
        config.Ticketing.expiredWinProb,
        config.Ticketing.decayRate,
        config.Ticketing.ticketDuration,
      ],
    },
    {
      name: ContractNames.deposits,
      args: [
        config.SyloToken,
        contracts[ContractNames.rewardsManager].address,
        contracts[ContractNames.ticketing].address,
        config.Deposits.unlockDuration,
      ],
    },
    {
      name: ContractNames.rewardsManager,
      args: [
        config.SyloToken,
        contracts[ContractNames.registries].address,
        contracts[ContractNames.protocolTimeManager].address,
        contracts[ContractNames.ticketing].address,
        contracts[ContractNames.stakingOrchestrator].address,
      ],
    },

    // staking
    {
      name: ContractNames.syloStakingManager,
      args: [
        config.SyloToken,
        contracts[ContractNames.stakingOrchestrator].address,
        config.SyloStakingManager.unlockDuration,
      ],
    },
    {
      name: ContractNames.stakingOrchestrator,
      args: [
        contracts[ContractNames.protocolTimeManager].address,
        contracts[ContractNames.seekerStatsOracle].address,
        contracts[ContractNames.syloStakingManager].address,
        contracts[ContractNames.seekerStakingManager].address,
        config.StakingOrchestrator.capacityCoverageMultiplier,
        config.StakingOrchestrator.capacityPenaltyFactor,
      ],
    },
    {
      name: ContractNames.seekerStakingManager,
      args: [
        config.Seekers,
        contracts[ContractNames.seekerStatsOracle].address,
        contracts[ContractNames.stakingOrchestrator].address,
      ],
    },
    {
      name: ContractNames.seekerStatsOracle,
      args: [statsOracle],
    },
  ];

  for (const { name, args } of initializeParams) {
    await initializeContract(name, args, deployer.address, execute);
  }

  await saveContracts(deployer.address, network.name, contracts, config);
};

export default func;

func.tags = ['001'];

function getConfig(networkName: string): configs.ContractParameters {
  switch (networkName) {
    case 'trn-mainnet':
      return configs.TRNMainnetParameters;
    case 'porcini-dev':
      return configs.PorciniDevParameters;
    case 'localhost':
    case 'hardhat':
      return configs.LocalTestnetParameters;
    default:
      throw new Error('unknown network: ' + networkName);
  }
}

async function deployContract(
  contractName: string,
  deployer: string,
  useProxy: boolean,
  deploy: (name: string, options: DeployOptions) => Promise<DeployResult>,
): Promise<DeployResult> {
  const proxy = useProxy
    ? {
        proxyContract: 'OpenZeppelinTransparentProxy',
      }
    : false;

  const result = await deploy(contractName, {
    from: deployer,
    log: true,
    proxy: proxy,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  printEmptyLine();

  return result;
}

async function initializeContract(
  contractName: string,
  args: unknown[],
  deployer: string,
  execute: (
    name: string,
    options: TxOptions,
    methodName: string,
    ...args: unknown[]
  ) => Promise<Receipt>,
): Promise<Receipt> {
  const result = await execute(
    contractName,
    { from: deployer, log: true },
    'initialize',
    ...args,
  );

  printEmptyLine();

  return result;
}

function printEmptyLine() {
  console.log('');
}

async function saveContracts(
  deployer: string,
  networkName: string,
  contracts: ContractMap,
  config: configs.ContractParameters,
) {
  const contractDeployInfo = {
    deployer,
    syloToken: config.SyloToken,
    syloStakingManager: contracts[ContractNames.syloStakingManager].address,
    seekerStatsOracle: contracts[ContractNames.seekerStatsOracle].address,
    seekerStakingManager: contracts[ContractNames.seekerStakingManager].address,
    seekers: config.Seekers,
    stakingOrchestrator: contracts[ContractNames.stakingOrchestrator].address,
    protocolTimeManager: contracts[ContractNames.protocolTimeManager].address,
    registries: contracts[ContractNames.registries].address,
    authorizedAccounts: contracts[ContractNames.authorizedAccounts].address,
    ticketing: contracts[ContractNames.ticketing].address,
    deposits: contracts[ContractNames.deposits].address,
    rewardsManager: contracts[ContractNames.rewardsManager].address,
    directory: contracts[ContractNames.directory].address,
    futurepassRegistrar: config.FuturepassRegistrar,
  };

  const filePath = path.join(process.cwd(), 'deployments');

  await fs.writeFile(
    `${filePath}/${networkName}_deployment_phase_two.json`,
    Buffer.from(JSON.stringify(contractDeployInfo, null, ' '), 'utf8'),
  );
}
