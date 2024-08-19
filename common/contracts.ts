import { ethers } from 'ethers';
import * as factories from '../typechain-types';

export const FixedContractNames = {
  syloToken: 'SyloToken',
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
  rewardsManager: factories.contracts.payments.RewardsManager;
  ticketing: factories.contracts.payments.Ticketing;
  stakingOrchestrator: factories.contracts.staking.StakingOrchestrator;
  directory: factories.contracts.Directory;
  futurepassRegistrar: factories.contracts.IFuturepassRegistrar;
  deposits: factories.contracts.payments.Deposits;
};

export type ContractAddresses = {
  syloToken: string;
  syloStakingManager: string;
  seekerStatsOracle: string;
  seekerStakingManager: string;
  seekers: string;
  stakingOrchestrator: string;
  protocolTimeManager: string;
  registries: string;
  authorizedAccounts: string;
  deposits: string;
  rewardsManager: string;
  ticketing: string;
  directory: string;
  futurepassRegistrar: string;
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

  const stakingOrchestrator = factories.StakingOrchestrator__factory.connect(
    contracts.stakingOrchestrator,
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

  const deposits = factories.Deposits__factory.connect(
    contracts.deposits,
    provider,
  );

  const ticketing = factories.Ticketing__factory.connect(
    contracts.ticketing,
    provider,
  );

  const directory = factories.Directory__factory.connect(
    contracts.directory,
    provider,
  );

  const futurepassRegistrar =
    factories.TestFuturepassRegistrar__factory.connect(
      contracts.futurepassRegistrar,
      provider,
    );

  const rewardsManager = factories.RewardsManager__factory.connect(
    contracts.rewardsManager,
    provider,
  );

  return {
    syloToken,
    syloStakingManager,
    seekerStatsOracle,
    seekerStakingManager,
    stakingOrchestrator,
    seekers,
    protocolTimeManager,
    registries,
    authorizedAccounts,
    deposits,
    ticketing,
    rewardsManager,
    directory,
    futurepassRegistrar,
  };
}
