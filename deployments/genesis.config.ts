import * as hre from 'hardhat';
import { BigNumberish, parseEther } from 'ethers';

type ContractParameters = {
  // Address of the existing Sylo Token
  SyloToken: string;

  // Address of the existing bridged Seekers contract
  Seekers: string;

  // Address of the pre-compile futurepass registrar
  FuturepassRegistrar: string;

  EpochsManager: {
    initialEpoch: number | Date;
    epochDuration: BigNumberish;
  };

  Registries: {
    defaultPayoutPercentage: number;
  };

  TicketingParameters: {
    faceValue: BigNumberish;
    baseLiveWinProb: BigNumberish;
    expiredWinProb: BigNumberish;
    ticketDuration: BigNumberish;
    decayRate: number;
  };

  Ticketing: {
    unlockDuration: BigNumberish;
  };

  StakingManager: {
    unlockDuration: BigNumberish;
    minimumStakeProportion: number;
    seekerPowerMultiplier: BigNumberish;
  };

  SeekerPowerOracle: {
    oracleAccount: string;
  };
};

const TRNMainnetParameters: ContractParameters = {
  SyloToken: '0xcCcCCCCc00000864000000000000000000000000',

  Seekers: '0xAAaaAAAA00008464000000000000000000000000',

  FuturepassRegistrar: '0x000000000000000000000000000000000000FFFF',

  EpochsManager: {
    initialEpoch: new Date('2024-03-10T22:00:00.000Z'), // March 11th 11am NZST
    epochDuration: 151200, // 1 Week
  },

  Registries: {
    defaultPayoutPercentage: 100000, // All rewards go to stakers
  },

  TicketingParameters: {
    faceValue: parseEther('25000'),
    baseLiveWinProb: (2n ** 128n - 1n) / 10n,
    expiredWinProb: 2n ** 128n - 1n,
    ticketDuration: 151200, // 1 Week
    decayRate: 80000,
  },

  Ticketing: {
    unlockDuration: 151200,
  },

  StakingManager: {
    unlockDuration: 151200,
    minimumStakeProportion: 1,
    seekerPowerMultiplier: hre.ethers.parseEther('100000000'),
  },

  SeekerPowerOracle: {
    oracleAccount: '0xf2eBb0bD5084DEF261e78D0d95a4CbeC3844922c', // deployer
  },
};

const GanacheTestnetParameters: ContractParameters = {
  SyloToken: '',

  Seekers: '',

  FuturepassRegistrar: '',

  EpochsManager: {
    initialEpoch: 0,
    epochDuration: 30, // 30 * 4 = 120 seconds = 2 minutes
  },

  Registries: {
    defaultPayoutPercentage: 50000,
  },

  TicketingParameters: {
    faceValue: 100000,
    baseLiveWinProb: (2n ** 128n - 1n) / 1000n,
    expiredWinProb: (2n ** 128n - 1n) / 1000n,
    ticketDuration: 10_000_000, // make sure the ticket never expires in the short time on testnet
    decayRate: 80000,
  },

  Ticketing: {
    unlockDuration: 30, // 30 * 4 = 120 seconds = 2 minutes
  },

  StakingManager: {
    unlockDuration: 30, // 30 * 4 = 120 seconds = 2 minutes
    minimumStakeProportion: 20000,
    seekerPowerMultiplier: parseEther('1000000'),
  },

  SeekerPowerOracle: {
    oracleAccount: '0x835dF5fE77D479695a616F79A3FC3a25310eb7c6', // deployer
  },
};

const PorciniDevParameters: ContractParameters = {
  SyloToken: '0xCCcCCcCC00000C64000000000000000000000000',

  Seekers: '0xAAAAAAAA00001864000000000000000000000000',

  FuturepassRegistrar: '0x000000000000000000000000000000000000FFFF',

  EpochsManager: {
    initialEpoch: 0,
    epochDuration: 360, // 4 minutes
  },

  Registries: {
    defaultPayoutPercentage: 100000,
  },

  TicketingParameters: {
    faceValue: hre.ethers.parseEther('100'),
    baseLiveWinProb: (2n ** 128n - 1n) / 10n, // 10%
    expiredWinProb: 2n ** 128n - 1n,
    ticketDuration: 17280, // 1 day
    decayRate: 80000,
  },

  Ticketing: {
    unlockDuration: 10,
  },

  StakingManager: {
    unlockDuration: 10,
    minimumStakeProportion: 1,
    seekerPowerMultiplier: hre.ethers.parseEther('4000000'),
  },

  SeekerPowerOracle: {
    oracleAccount: '0x448c8e9e1816300Dd052e77D2A44c990A2807D15',
  },
};

export { TRNMainnetParameters, GanacheTestnetParameters, PorciniDevParameters };

export type { ContractParameters };
