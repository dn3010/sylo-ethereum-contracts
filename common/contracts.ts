import { ethers } from 'ethers';
import * as factories from '../typechain-types';

export const FixedContractNames = {
  syloToken: 'SyloToken',
};

export const DeployedContractNames = {
  syloStakingManager: 'SyloStakingManager',
  seekerStatsOracle: 'SeekerStatsOracle',
  seekerStakingManager: 'SeekerStakingManager',
  protocolTimeManager: 'ProtocolTimeManager',
  registries: 'Registries',
  authorizedAccounts: 'AuthorizedAccounts',
  rewardsManager: 'RewardsManager',
  ticketing: 'Ticketing',
  StakingOrchestrator: 'StakingOrchestrator',
};

export const ContractNames = {
  ...FixedContractNames,
  ...DeployedContractNames,
};

export type SyloContracts = {
  syloToken: factories.contracts.SyloToken;
  syloStakingManager: factories.contracts.staking.sylo.SyloStakingManager;
  seekerStatsOracle: factories.contracts.staking.seekers.SeekerStatsOracle;
  seekerStakingManager: factories.contracts.staking.seekers.SeekerStakingManager;
  seekers: factories.contracts.mocks.TestSeekers;
  protocolTimeManager: factories.contracts.ProtocolTimeManager;
  registries: factories.contracts.Registries;
  authorizedAccounts: factories.contracts.AuthorizedAccounts;
  rewardsManager: factories.contracts.RewardsManager;
  ticketing: factories.contracts.Ticketing;
  stakingOrchestrator: factories.contracts.staking.StakingOrchestrator;
};

export type ContractAddresses = {
  syloToken: string;
  syloStakingManager: string;
  seekerStatsOracle: string;
  seekerStakingManager: string;
  seekers: string;
  protocolTimeManager: string;
  registries: string;
  authorizedAccounts: string;
  rewardsManager: string;
  ticketing: string;
  stakingOrchestator: string;
};

export function connectContracts(
  contracts: ContractAddresses,
  provider: ethers.ContractRunner,
): SyloContracts {
  const syloToken = factories.SyloToken__factory.connect(
    contracts.syloToken,
    provider,
  );

  const syloStakingManager = factories.SyloStakingManager__factory.connect(
    contracts.syloStakingManager,
    provider,
  );

  const seekerStatsOracle = factories.SeekerStatsOracle__factory.connect(
    contracts.seekerStatsOracle,
    provider,
  );

  const seekerStakingManager = factories.SeekerStakingManager__factory.connect(
    contracts.seekerStakingManager,
    provider,
  );

  const seekers = factories.TestSeekers__factory.connect(
    contracts.seekers,
    provider,
  );

  const protocolTimeManager = factories.ProtocolTimeManager__factory.connect(
    contracts.protocolTimeManager,
    provider,
  );

  const registries = factories.Registries__factory.connect(
    contracts.registries,
    provider,
  );

  const authorizedAccounts = factories.AuthorizedAccounts__factory.connect(
    contracts.authorizedAccounts,
    provider,
  );

  const rewardsManager = factories.RewardsManager__factory.connect(
    contracts.rewardsManager,
    provider,
  );

  const ticketing = factories.Ticketing__factory.connect(
    contracts.ticketing,
    provider,
  );

  const stakingOrchestrator = factories.StakingOrchestrator__factory.connect(
    contracts.stakingOrchestator,
    provider,
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
    rewardsManager,
    ticketing,
    stakingOrchestrator,
  };
}
