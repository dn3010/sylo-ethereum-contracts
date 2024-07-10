import { ethers } from 'hardhat';
import { SyloContracts } from '../common/contracts';
import { Address } from 'hardhat-deploy/types';
import { ProtocolTimeManager } from '../typechain-types';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { Block } from 'ethers';

export const MAX_SYLO = ethers.parseEther('10000000000');

export enum signatureTypes {
  main,
  authorizedAccount,
  attachedAccount,
}

export type DeploymentOptions = {
  syloStakingManager?: {
    unlockDuration?: number;
  };
  seekerStatsOracle?: {
    oracleAccount?: Address;
  };
  stakingOrchestrator?: {
    capacityCoverageMultiplier?: number;
    capacityPenaltyFactor?: number;
  };
  protocolTimeManager?: {
    cycleDuration?: number;
    periodDuration?: number;
  };
  registries?: {
    defaultPayoutPercentage: number;
  };
  deposits?: {
    unlockDuration?: number;
  };
  ticketing?: {
    faceValue?: bigint;
    multiReceiverFaceValue?: bigint;
    baseLiveWinProb?: bigint;
    expiredWinProb?: bigint;
    ticketDuration?: bigint;
    decayRate?: bigint;
  };
};

export async function deployContracts(
  opts: DeploymentOptions = {},
): Promise<SyloContracts> {
  // Factories
  const syloTokenFactory = await ethers.getContractFactory('SyloToken');
  const FuturepassRegistrarFactory = await ethers.getContractFactory(
    'TestFuturepassRegistrar',
  );
  const syloStakingManagerFactory = await ethers.getContractFactory(
    'SyloStakingManager',
  );
  const seekerStatsOracleFactory = await ethers.getContractFactory(
    'SeekerStatsOracle',
  );
  const seekerStakingManagerFactor = await ethers.getContractFactory(
    'SeekerStakingManager',
  );
  const seekersFactory = await ethers.getContractFactory('TestSeekers');
  const protocolTimeManagerFactory = await ethers.getContractFactory(
    'ProtocolTimeManager',
  );
  const registriesFactory = await ethers.getContractFactory('Registries');
  const authorizedAccountsFactory = await ethers.getContractFactory(
    'AuthorizedAccounts',
  );
  const depositsFactory = await ethers.getContractFactory('Deposits');
  const rewardsManagerFactory = await ethers.getContractFactory(
    'RewardsManager',
  );
  const ticketingFactory = await ethers.getContractFactory('Ticketing');
  const stakingOrchestratorFactory = await ethers.getContractFactory(
    'StakingOrchestrator',
  );
  const directoryFactory = await ethers.getContractFactory('Directory');

  // Deploy
  const syloToken = await syloTokenFactory.deploy();
  const futurepassRegistrar = await FuturepassRegistrarFactory.deploy();
  const syloStakingManager = await syloStakingManagerFactory.deploy();
  const seekerStatsOracle = await seekerStatsOracleFactory.deploy();
  const seekers = await seekersFactory.deploy();
  const seekerStakingManager = await seekerStakingManagerFactor.deploy();
  const protocolTimeManager = await protocolTimeManagerFactory.deploy();
  const registries = await registriesFactory.deploy();
  const authorizedAccounts = await authorizedAccountsFactory.deploy();
  const deposits = await depositsFactory.deploy();
  const rewardsManager = await rewardsManagerFactory.deploy();
  const ticketing = await ticketingFactory.deploy();
  const stakingOrchestrator = await stakingOrchestratorFactory.deploy();
  const directory = await directoryFactory.deploy();

  // Options
  const syloStakingManagerOpts = {
    unlockDuration: opts.syloStakingManager?.unlockDuration ?? 10,
  };

  const seekerStatsOracleOpts = {
    oracleAccount:
      opts.seekerStatsOracle?.oracleAccount ??
      (await (await ethers.getSigners())[0].getAddress()),
  };

  const stakingOrchestratorOpts = {
    capacityCoverageMultiplier:
      opts.stakingOrchestrator?.capacityCoverageMultiplier ?? 1000,
    capacityPenaltyFactor: opts.stakingOrchestrator?.capacityPenaltyFactor ?? 4,
  };

  const protocolTimeManagerOpts = {
    cycleDuration: opts.protocolTimeManager?.cycleDuration ?? 1000,
    periodDuration: opts.protocolTimeManager?.periodDuration ?? 100,
  };

  const registriesOpts = {
    defaultPayoutPercentage: 5000,
  };

  const depositsOpts = {
    unlockDuration: opts.deposits?.unlockDuration ?? 10,
  };

  const ticketingOpts = {
    faceValue: opts.ticketing?.faceValue ?? 1000n,
    multiReceiverFaceValue: opts.ticketing?.multiReceiverFaceValue ?? 1000n,
    baseLiveWinProb: opts.ticketing?.baseLiveWinProb ?? 2n ** 128n - 1n,
    expiredWinProb: opts.ticketing?.expiredWinProb ?? 2n ** 128n - 1n,
    ticketDuration: opts.ticketing?.ticketDuration ?? 1000n,
    decayRate: opts.ticketing?.decayRate ?? 80000n,
  };

  // Initliaze
  await syloStakingManager.initialize(
    await syloToken.getAddress(),
    syloStakingManagerOpts.unlockDuration,
  );

  await seekerStatsOracle.initialize(seekerStatsOracleOpts.oracleAccount);

  await seekerStakingManager.initialize(
    await seekers.getAddress(),
    await seekerStatsOracle.getAddress(),
  );

  await stakingOrchestrator.initialize(
    protocolTimeManager.getAddress(),
    seekerStatsOracle.getAddress(),
    stakingOrchestratorOpts.capacityCoverageMultiplier,
    stakingOrchestratorOpts.capacityPenaltyFactor,
  );

  await registries.initialize(registriesOpts.defaultPayoutPercentage);

  await authorizedAccounts.initialize();

  await deposits.initialize(
    await syloToken.getAddress(),
    await rewardsManager.getAddress(),
    await ticketing.getAddress(),
    depositsOpts.unlockDuration,
  );

  await ticketing.initialize(
    syloToken.getAddress(),
    deposits.getAddress(),
    registries.getAddress(),
    rewardsManager.getAddress(),
    authorizedAccounts.getAddress(),
    futurepassRegistrar.getAddress(),
    ticketingOpts.faceValue,
    ticketingOpts.multiReceiverFaceValue,
    ticketingOpts.baseLiveWinProb,
    ticketingOpts.expiredWinProb,
    ticketingOpts.decayRate,
    ticketingOpts.ticketDuration,
  );

  await rewardsManager.initialize(await registries.getAddress(), ticketing);
  await directory.initialize(
    await stakingOrchestrator.getAddress(),
    await protocolTimeManager.getAddress(),
  );
  await protocolTimeManager.initialize(
    protocolTimeManagerOpts.cycleDuration,
    protocolTimeManagerOpts.periodDuration,
  );

  return {
    syloToken,
    syloStakingManager,
    seekerStatsOracle,
    seekerStakingManager,
    seekers,
    protocolTimeManager,
    registries,
    authorizedAccounts,
    deposits,
    rewardsManager,
    ticketing,
    stakingOrchestrator,
    directory,
    futurepassRegistrar,
  };
}

export function getInterfaceId(abi: string[]): string {
  const iface = new ethers.Interface(abi);

  const selectors: string[] = [];

  iface.forEachFunction(f => {
    selectors.push(f.selector);
  });

  const interfaceId = selectors.reduce((id, selector) => {
    const selectorBytes = ethers.getBytes(selector);
    const idBytes = ethers.getBytes(id);
    return ethers.hexlify(
      selectorBytes.map((byte, index) => byte ^ idBytes[index]),
    );
  }, '0x00000000');

  return interfaceId;
}

export async function getLatestBlock(): Promise<Block> {
  const block = await ethers.provider.getBlock('latest');

  if (!block) {
    throw new Error('failed to get latest block');
  }

  return block;
}

export type ProtocolTimeManagerUtilities = {
  startProtocol: () => Promise<{
    start: number;
    setTimeSinceStart: (time: number) => Promise<void>;
  }>;
  setProtocolStartIn: (time: number) => Promise<number>;
};

export function getTimeManagerUtil(
  protocolTimeManager: ProtocolTimeManager,
): ProtocolTimeManagerUtilities {
  const setProtocolStartIn = async (time: number): Promise<number> => {
    const block = await ethers.provider.getBlock('latest').then(b => {
      if (!b) throw new Error('block undefined');
      return b;
    });

    await protocolTimeManager.setProtocolStart(block.timestamp + time);
    return protocolTimeManager.getStart().then(Number);
  };

  const startProtocol = async (): Promise<{
    start: number;
    setTimeSinceStart: (time: number) => Promise<void>;
  }> => {
    const start = await setProtocolStartIn(100);
    await increaseTo(start);
    const setTimeSinceStart = async (time: number): Promise<void> => {
      return increaseTo(start + time);
    };
    return { start, setTimeSinceStart };
  };

  return { startProtocol, setProtocolStartIn };
}
