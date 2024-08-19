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
import { ContractNames, DeployedContractNames } from '../common/contracts';

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

  let epochStartBlock = 0;
  if (typeof config.EpochsManager.initialEpoch === 'number') {
    epochStartBlock = config.EpochsManager.initialEpoch;
  } else {
    const startDate: Date = config.EpochsManager.initialEpoch;
    const currentTime = Date.now();
    const msUntilStart = startDate.getTime() - currentTime;
    const blocksUntilStart = Math.floor(msUntilStart / 4000);
    const currentBlock = await deployer.provider.getBlock('latest');
    if (currentBlock == null) {
      throw new Error('could not determine current block');
    }

    epochStartBlock = currentBlock.number + blocksUntilStart;
  }

  for (const name of Object.values(DeployedContractNames)) {
    contracts[name] = await deployContract(
      name,
      deployer.address,
      true,
      deploy,
    );
  }

  // INITIALIZE CONTRACTS
  const initializeParams: ContractParams[] = [
    {
      name: ContractNames.authorizedAccounts,
      args: [],
    },
    {
      name: ContractNames.registries,
      args: [config.Seekers, config.Registries.defaultPayoutPercentage],
    },
    {
      name: ContractNames.ticketingParameters,
      args: [
        config.TicketingParameters.faceValue,
        config.TicketingParameters.baseLiveWinProb,
        config.TicketingParameters.expiredWinProb,
        config.TicketingParameters.decayRate,
        config.TicketingParameters.ticketDuration,
      ],
    },
    {
      name: ContractNames.epochsManager,
      args: [
        config.Seekers,
        contracts[ContractNames.directory].address,
        contracts[ContractNames.registries].address,
        contracts[ContractNames.ticketingParameters].address,
        epochStartBlock,
        config.EpochsManager.epochDuration,
      ],
    },
    {
      name: ContractNames.stakingManager,
      args: [
        config.SyloToken,
        contracts[ContractNames.rewardsManager].address,
        contracts[ContractNames.epochsManager].address,
        contracts[ContractNames.seekerPowerOracle].address,
        config.StakingManager.unlockDuration,
        config.StakingManager.minimumStakeProportion,
        config.StakingManager.seekerPowerMultiplier,
      ],
    },
    {
      name: ContractNames.rewardsManager,
      args: [
        config.SyloToken,
        contracts[ContractNames.stakingManager].address,
        contracts[ContractNames.epochsManager].address,
      ],
    },
    {
      name: ContractNames.directory,
      args: [
        contracts[ContractNames.stakingManager].address,
        contracts[ContractNames.rewardsManager].address,
      ],
    },
    {
      name: ContractNames.syloTicketing,
      args: [
        config.SyloToken,
        contracts[ContractNames.registries].address,
        contracts[ContractNames.stakingManager].address,
        contracts[ContractNames.directory].address,
        contracts[ContractNames.epochsManager].address,
        contracts[ContractNames.rewardsManager].address,
        contracts[ContractNames.authorizedAccounts].address,
        config.FuturepassRegistrar,
        config.Ticketing.unlockDuration,
      ],
    },
    {
      name: ContractNames.seekerPowerOracle,
      args: [config.SeekerPowerOracle.oracleAccount],
    },
  ];
  for (const { name, args } of initializeParams) {
    await initializeContract(name, args, deployer.address, execute);
  }

  // ADD MANAGERS
  const addManagerParams: ContractParams[] = [
    {
      name: ContractNames.directory,
      args: [contracts[ContractNames.epochsManager].address],
    },
    {
      name: ContractNames.rewardsManager,
      args: [contracts[ContractNames.syloTicketing].address],
    },
    {
      name: ContractNames.rewardsManager,
      args: [contracts[ContractNames.stakingManager].address],
    },
    {
      name: ContractNames.rewardsManager,
      args: [contracts[ContractNames.epochsManager].address],
    },
  ];
  for (const { name, args } of addManagerParams) {
    await addManager(name, deployer.address, args[0] as string, execute);
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
      return configs.GanacheTestnetParameters;
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

async function addManager(
  contractName: string,
  deployer: string,
  manager: string,
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
    'addManager',
    manager,
  );

  printEmptyLine();

  return result;
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
    authorizedAccounts: contracts[ContractNames.authorizedAccounts].address,
    registries: contracts[ContractNames.registries].address,
    ticketingParameters: contracts[ContractNames.ticketingParameters].address,
    epochsManager: contracts[ContractNames.epochsManager].address,
    stakingManager: contracts[ContractNames.stakingManager].address,
    rewardsManager: contracts[ContractNames.rewardsManager].address,
    directory: contracts[ContractNames.directory].address,
    syloTicketing: contracts[ContractNames.syloTicketing].address,
    seekers: config.Seekers,
    seekerPowerOracle: contracts[ContractNames.seekerPowerOracle].address,
    futurepassRegistrar: config.FuturepassRegistrar,
  };

  const filePath = path.join(process.cwd(), 'deployments');

  await fs.writeFile(
    `${filePath}/${networkName}_deployment_phase_two.json`,
    Buffer.from(JSON.stringify(contractDeployInfo, null, ' '), 'utf8'),
  );
}

function printEmptyLine() {
  console.log('');
}
