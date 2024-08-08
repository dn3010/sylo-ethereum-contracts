import * as hre from 'hardhat';
import { BigNumberish, parseEther } from 'ethers';

type ContractParameters = {
  // Address of the existing Sylo Token
  SyloToken: string;

  // Address of the existing bridged Seekers contract
  Seekers: string;

  // Address of the pre-compile futurepass registrar
  FuturepassRegistrar: string;

  ProtocolTimeManager: {
    cycleDuration: number;
    periodDuration: number;
  };

  Registries: {
    defaultPayoutPercentage: number;
  };

  Ticketing: {
    faceValue: BigNumberish;
    multiReceiverFaceValue: BigNumberish;
    baseLiveWinProb: BigNumberish;
    expiredWinProb: BigNumberish;
    ticketDuration: BigNumberish;
    decayRate: number;
  };

  Deposits: {
    unlockDuration: BigNumberish;
  };

  SyloStakingManager: {
    unlockDuration: BigNumberish;
  };

  SeekerStatsOracle: {
    oracle?: string;
  };

  StakingOrchestrator: {
    capacityCoverageMultiplier: BigNumberish;
    capacityPenaltyFactor: BigNumberish;
  };
};

const TRNMainnetParameters: ContractParameters = {
  SyloToken: '0xcCcCCCCc00000864000000000000000000000000',

  Seekers: '0xAAaaAAAA00008464000000000000000000000000',

  FuturepassRegistrar: '0x000000000000000000000000000000000000FFFF',

  ProtocolTimeManager: {
    cycleDuration: 3628800, // 6 weeks
    periodDuration: 86400, // 1 day
  },

  Registries: {
    defaultPayoutPercentage: 100000, // All rewards go to stakers
  },

  Ticketing: {
    faceValue: parseEther('25000'),
    multiReceiverFaceValue: parseEther('25000'),
    baseLiveWinProb: (2n ** 128n - 1n) / 10n,
    expiredWinProb: 2n ** 128n - 1n,
    ticketDuration: 151200, // 1 Week
    decayRate: 80000,
  },

  Deposits: {
    unlockDuration: 151200,
  },

  SyloStakingManager: {
    unlockDuration: 151200,
  },

  SeekerStatsOracle: {
    oracle: '0xf2eBb0bD5084DEF261e78D0d95a4CbeC3844922c', // deployer
  },

  StakingOrchestrator: {
    capacityCoverageMultiplier: 1_000_000, // TODO
    capacityPenaltyFactor: 4,
  },
};

const LocalTestnetParameters: ContractParameters = {
  SyloToken: '',

  Seekers: '',

  FuturepassRegistrar: '',

  ProtocolTimeManager: {
    cycleDuration: 1000,
    periodDuration: 100,
  },

  Registries: {
    defaultPayoutPercentage: 100000, // All rewards go to stakers
  },

  Ticketing: {
    faceValue: hre.ethers.parseEther('100'),
    multiReceiverFaceValue: 100000,
    baseLiveWinProb: 2n ** 128n - 1n,
    expiredWinProb: 2n ** 128n - 1n,
    ticketDuration: 10_000_000, // make sure the ticket never expires in the short time on testnet
    decayRate: 80000,
  },

  Deposits: {
    unlockDuration: 5,
  },

  SyloStakingManager: {
    unlockDuration: 5,
  },

  SeekerStatsOracle: {},

  StakingOrchestrator: {
    capacityCoverageMultiplier: 1_000_000, // TODO
    capacityPenaltyFactor: 4,
  },
};

const PorciniDevParameters: ContractParameters = {
  SyloToken: '0xCCcCCcCC00000C64000000000000000000000000',

  Seekers: '0xAAAAAAAA00001864000000000000000000000000',

  FuturepassRegistrar: '0x000000000000000000000000000000000000FFFF',

  ProtocolTimeManager: {
    cycleDuration: 86400, // 1 day
    periodDuration: 3600, // 1 hour
  },

  Registries: {
    defaultPayoutPercentage: 100000, // All rewards go to stakers
  },

  Ticketing: {
    faceValue: hre.ethers.parseEther('100'),
    multiReceiverFaceValue: hre.ethers.parseEther('100'),
    baseLiveWinProb: (2n ** 128n - 1n) / 10n, // 10%
    expiredWinProb: 2n ** 128n - 1n,
    ticketDuration: 17280, // 1 day
    decayRate: 80000,
  },

  Deposits: {
    unlockDuration: 30,
  },

  SyloStakingManager: {
    unlockDuration: 30,
  },

  SeekerStatsOracle: {},

  StakingOrchestrator: {
    capacityCoverageMultiplier: 1_000_000, // TODO
    capacityPenaltyFactor: 4,
  },
};

export { TRNMainnetParameters, LocalTestnetParameters, PorciniDevParameters };

export type { ContractParameters };
