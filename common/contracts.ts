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
};

export type ContractAddresses = {
  syloToken: string;
  syloStakingManager: string;
  seekerStatsOracle: string;
  seekerStakingManager: string;
  seekers: string;
  protocolTimeManager: string;
  registries: string;
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

  return {
    syloToken,
    syloStakingManager,
    seekerStatsOracle,
    seekerStakingManager,
    seekers,
    protocolTimeManager,
    registries,
  };
}
