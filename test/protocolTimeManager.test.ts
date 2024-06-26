import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { SyloContracts } from '../common/contracts';
import { expect, assert } from 'chai';
import { deployContracts } from './utils';
import { ProtocolTimeManager } from '../typechain-types';
import { getInterfaceId } from './utils';
import {
  increase,
  increaseTo,
} from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

describe('Protocol time manager', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let protocolTimeManager: ProtocolTimeManager;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    protocolTimeManager = contracts.protocolTimeManager;
  });

  it('cannot initialize protocol time manager with empty cycle duration', async () => {
    const factory = await ethers.getContractFactory('ProtocolTimeManager');
    const protocolTimeManagerTemp = await factory.deploy();

    await expect(
      protocolTimeManagerTemp.initialize(0, 0),
    ).to.be.revertedWithCustomError(
      protocolTimeManagerTemp,
      'CannotInitializeWithZeroCycleDuration',
    );
  });

  it('cannot initialize protocol time manager with empty period duration', async () => {
    const factory = await ethers.getContractFactory('ProtocolTimeManager');
    const protocolTimeManagerTemp = await factory.deploy();

    await expect(
      protocolTimeManagerTemp.initialize(1000, 0),
    ).to.be.revertedWithCustomError(
      protocolTimeManagerTemp,
      'CannotInitializeWithZeroPeriodDuration',
    );
  });

  it('cannot initialize protocol time manager more than once', async () => {
    await expect(protocolTimeManager.initialize(1000, 1000)).to.be.revertedWith(
      'Initializable: contract is already initialized',
    );
  });

  it('cannot set protocol start with zero value', async () => {
    await expect(
      protocolTimeManager.setProtocolStart(0),
    ).to.be.revertedWithCustomError(
      protocolTimeManager,
      'CannotSetProtocolStartToZero',
    );
  });

  it('reverts when setting protocol start as non-owner', async () => {
    await expect(
      protocolTimeManager.connect(accounts[1]).setProtocolStart(1),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('reverts when setting cycle duration as non-owner', async () => {
    await expect(
      protocolTimeManager.connect(accounts[1]).setCycleDuration(1),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('reverts when setting period duration as non-owner', async () => {
    await expect(
      protocolTimeManager.connect(accounts[1]).setPeriodDuration(1),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('cannot set protocol start in the past', async () => {
    await expect(
      protocolTimeManager.setProtocolStart(1),
    ).to.be.revertedWithCustomError(
      protocolTimeManager,
      'CannotSetStartInThePast',
    );
  });

  it('cannot set protocol start once already started', async () => {
    const { start } = await startProtocol();

    await expect(
      protocolTimeManager.setProtocolStart(start + 1000),
    ).to.be.revertedWithCustomError(
      protocolTimeManager,
      'CannotSetStartAfterProtocolHasStarted',
    );
  });

  it('can set protocol start', async () => {
    const start = await protocolTimeManager.getStart();
    assert.equal(Number(start), 0);

    const block = await ethers.provider.getBlock('latest').then(b => {
      if (!b) throw new Error('block undefined');
      return b;
    });

    const newStart = await setProtocolStartIn(100);

    assert.equal(Number(newStart), block.timestamp + 100);
  });

  it('cannot set zero cycle duration', async () => {
    await expect(
      protocolTimeManager.setCycleDuration(0),
    ).to.be.revertedWithCustomError(
      protocolTimeManager,
      'CannotSetZeroCycleDuration',
    );
  });

  it('can set cycle duration before protocol has started', async () => {
    await protocolTimeManager.setCycleDuration(2000);

    await setProtocolStartIn(100);
    await increase(101);

    const cycleDuration = await protocolTimeManager.getCycleDuration();

    expect(cycleDuration).to.equal(2000n);
  });

  it('can get cycle duration before protocol has started', async () => {
    const cycleDuration = await protocolTimeManager.getCycleDuration();
    expect(cycleDuration).to.equal(1000n);
  });

  it('cannot set zero period duration', async () => {
    await expect(
      protocolTimeManager.setPeriodDuration(0),
    ).to.be.revertedWithCustomError(
      protocolTimeManager,
      'CannotSetZeroPeriodDuration',
    );
  });

  it('can set period duration before protocol has started', async () => {
    await protocolTimeManager.setPeriodDuration(500);

    await setProtocolStartIn(100);
    await increase(101);

    const periodDuration = await protocolTimeManager.getPeriodDuration();

    expect(periodDuration).to.equal(500n);
  });

  it('can get period duration before protocol has started', async () => {
    const periodDuration = await protocolTimeManager.getPeriodDuration();
    expect(periodDuration).to.equal(100n);
  });

  it('cannot get cycle without protocol start', async () => {
    await expect(protocolTimeManager.getCurrentCycle()).revertedWithCustomError(
      protocolTimeManager,
      'ProtocolHasNotBegun',
    );
  });

  it('cannot get period without protocol start', async () => {
    await expect(
      protocolTimeManager.getCurrentPeriod(),
    ).revertedWithCustomError(protocolTimeManager, 'ProtocolHasNotBegun');
  });

  it('returns one for first cycle', async () => {
    await startProtocol();

    await checkCycle(1);
  });

  it('can get current cycle without updated duration', async () => {
    const { setTimeSinceStart } = await startProtocol();

    await setTimeSinceStart(3500);

    await checkCycle(4);
  });

  it('can get current cycle with one updated duration', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1
     */
    await checkCycle(1);

    /**
     * 0 - C1
     * 1000 - C2
     * 1000 - Current Timestamp
     *
     * Cycle 3 is expected to start at 2000.
     */
    await setTimeSinceStart(1000);
    await checkCycle(2);

    /**
     * 0 - C1
     * 1000 - C2
     * 1000 - Current Timestamp
     * setCycleDuration(200)
     *
     * Cycle 3 is expected to start at 2000.
     */
    await protocolTimeManager.setCycleDuration(200);
    await checkCycle(2);

    /**
     * 0 - C1
     * 1000 - C2
     * 1000 - Current Timestamp
     * setCycleDuration(200)
     * 2000 - C3
     * 2200 - C4
     * 2400 - C5
     * 2600 - C6
     * 2600 - Current Timestamp
     */
    await setTimeSinceStart(2600);
    await checkCycle(6);
  });

  it('can get current cycle with multiple updated durations', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1
     */
    await checkCycle(1);

    /**
     * 0 - C1
     * 1000 - C2
     * 2000 - C3
     *
     * Cycle 4 is expected to start at 3000.
     */
    await setTimeSinceStart(2000);
    await checkCycle(3);

    await protocolTimeManager.setCycleDuration(200);

    /**
     * 0 - C1
     * 1000 - C2
     * 2000 - C3
     * setCycleDuration(200)
     * 3000 - C4
     * 3200 - C5
     * 3400 - C6
     * 3600 - C7
     * 3800 - C8
     * 4000 - C9
     * 4200 - C10
     * 4400 - C11
     * 4600 - C12
     * 4800 - C13
     * 5000 - C14
     * 5000 - Current Time
     *
     * Cycle 14 is expected to start at 5100.
     */
    await setTimeSinceStart(5000);
    await checkCycle(14);

    await protocolTimeManager.setCycleDuration(125);

    /**
     * 5000 - C14
     * setCycleDuration(125)
     * 5200 - C15
     * 5325 - C16
     * 5450 - C17
     * 5575 - C18
     * 5700 - C19
     * 5825 - C20
     * 5825 - Current Time
     */
    await setTimeSinceStart(5825);
    await checkCycle(20);

    await protocolTimeManager.setCycleDuration(2);

    /**
     * 5825 - C20
     * setCycleDuration(2)
     * 5950 - C21
     * 5952 - C22
     * 5954 - C23
     * 5956 - C24
     * ...
     * 6400 - C246
     * 6400 - Current Time
     */
    await setTimeSinceStart(6400);
    await checkCycle(246);
  });

  it('can get current cycle with multiple duration updates within the same cycle', async () => {
    const { setTimeSinceStart } = await startProtocol();

    // only the final duration update (777) should count
    await protocolTimeManager.setCycleDuration(555);
    await protocolTimeManager.setCycleDuration(666);
    await protocolTimeManager.setCycleDuration(777);

    /**
     * 0 - C1
     * setCycleDuration(555);
     * setCycleDuration(666);
     * setCycleDuration(777);
     * 1000 - C2
     * 1777 - C3
     * 1777 - Current Time
     */
    await setTimeSinceStart(1777);
    await checkCycle(3);

    /**
     * 0 - C1
     * setCycleDuration(555);
     * setCycleDuration(666);
     * setCycleDuration(777);
     * 1000 - C2
     * 1777 - C3
     * 2564 - C4
     * 2564 - Current Time
     */
    await setTimeSinceStart(2564);
    await checkCycle(4);
  });

  it('cycle duration updates only take effect for the next cycle', async () => {
    const { setTimeSinceStart } = await startProtocol();

    await protocolTimeManager.setCycleDuration(333);

    const duration = await protocolTimeManager.getCycleDuration();

    assert.equal(Number(duration), 1000);

    await setTimeSinceStart(1500);

    const durationAfter = await protocolTimeManager.getCycleDuration();

    assert.equal(Number(durationAfter), 333);
  });

  it('returns 0 for first period', async () => {
    await startProtocol();

    await checkPeriod(0);
  });

  it('can get current period without updated duration', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1 : P0
     * 100 - C1 : P1
     * 200 - C1 : P2
     * 300 - C1 : P3
     * 400 - C1 : P4
     * 500 - C1 : P5
     */
    await setTimeSinceStart(500);
    await checkPeriod(5);
  });

  it('can get current period with one updated duration', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1 : P0
     * ..
     * 500 - C1 : P5
     */
    await setTimeSinceStart(500);
    await checkPeriod(5);

    // update to period duration will take effect next cycle
    await protocolTimeManager.setPeriodDuration(200);

    /**
     * 1000 - C2 : P0
     */
    await setTimeSinceStart(1000);
    await checkCycle(2);

    /**
     * 1000 - C2 : P0
     * 1200 - C2 : P1
     * 1400 - C2 : P2
     * 1600 - C2 : P3
     * 1800 - C2 : P4
     * 1900 - Current Time
     */
    await setTimeSinceStart(1900);
    await checkPeriod(4);
  });

  it('can get current period with multiple updated durations', async () => {
    const { setTimeSinceStart } = await startProtocol();

    await protocolTimeManager.setPeriodDuration(200);

    await setTimeSinceStart(1000);
    await checkPeriod(0);

    await setTimeSinceStart(1900);
    await checkPeriod(4);

    await protocolTimeManager.setPeriodDuration(125);

    await setTimeSinceStart(2000);
    // confirm we are back to the start of the next cycle
    await checkPeriod(0);

    /**
     * 2000 - C3 : P0
     * 2125 - C3 : P1
     * 2250 - C3 : P2
     * 2375 - C3 : P3
     * 2500 - C3 : P4
     * 2625 - C3 : P5
     * 2700 - Current Time
     */
    await setTimeSinceStart(2700);
    await checkPeriod(5);

    await protocolTimeManager.setPeriodDuration(2);

    await setTimeSinceStart(3000);
    await checkPeriod(0);

    /**
     * 3000 - C4 : P0
     * 3002 - C4 : P1
     * 3004 - C4 : P2
     * ..
     * 3600 - C4 : P300
     */
    await setTimeSinceStart(3600);
    await checkPeriod(300);
  });

  it('can get current period with multiple duration updates in the same cycle', async () => {
    const { setTimeSinceStart } = await startProtocol();

    // only the last period duration update will take effect
    await protocolTimeManager.setPeriodDuration(200);
    await protocolTimeManager.setPeriodDuration(233);
    await protocolTimeManager.setPeriodDuration(333);

    await setTimeSinceStart(1000);
    await checkCycle(2);
    await checkPeriod(0);

    /**
     * 1000 - C2 : P0
     * 1333 - C2 : P1
     * 1666 - C2 : P2
     * 1999 - C2 : P3
     */
    await setTimeSinceStart(1999);
    await checkPeriod(3);
  });

  it('period duration updates only take effect for the next cycle', async () => {
    const { setTimeSinceStart } = await startProtocol();

    await protocolTimeManager.setPeriodDuration(333);

    const duration = await protocolTimeManager.getPeriodDuration();

    assert.equal(Number(duration), 100);

    await setTimeSinceStart(1000);

    const durationAfter = await protocolTimeManager.getPeriodDuration();

    assert.equal(Number(durationAfter), 333);
  });

  it('cannot get current time if protocol not started', async () => {
    await expect(protocolTimeManager.getTime()).revertedWithCustomError(
      protocolTimeManager,
      'ProtocolHasNotBegun',
    );
  });

  it('can get current time', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1 : P0
     */
    await checkTime(1, 0);

    /**
     * 0 - C1 : P0
     * 100 - C1 : P1
     * ...
     * 600 - C1 : P6
     */
    await setTimeSinceStart(600);
    await checkTime(1, 6);

    /**
     * 3000 - C4 : P0
     * 3100 - C4 : P1
     * ..
     * 3400 - C4 : P4
     */
    await setTimeSinceStart(3400);
    await checkTime(4, 4);
  });

  it('can get current time when durations have been updated', async () => {
    const { setTimeSinceStart } = await startProtocol();

    /**
     * 0 - C1 : P0
     */
    await checkTime(1, 0);

    await protocolTimeManager.setCycleDuration(500);
    await protocolTimeManager.setPeriodDuration(25);

    /**
     * setCycleDuration(500)
     * setPeriodDuration(25)
     * 1000 - C2 : P0
     * 1025 - C2 : P1
     * 1050 - C2 : P2
     * ...
     * 1450 - C2 : P18
     */
    await setTimeSinceStart(1450);
    await checkTime(2, 18);

    await setTimeSinceStart(1500);
    await checkTime(3, 0);
  });

  it('protocol time manager supports correct interfaces', async () => {
    const abi = [
      'function setProtocolStart(uint256 _start) external',
      'function setCycleDuration(uint256 duration) external',
      'function setPeriodDuration(uint256 duration) external',
      'function getCycleDuration() external returns (uint256)',
      'function getPeriodDuration() external returns (uint256)',
      'function getTime() external returns (uint256, uint256, (uint256,uint256,uint256))',
      'function getCurrentCycle() external returns ((uint256,uint256,uint256))',
      'function getCurrentPeriod() external returns (uint256)',
      'function getStart() external view returns (uint256)',
      'function isFinalStakingPeriod() external view returns (bool)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await protocolTimeManager.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected protocol time manager to support correct interface',
    );

    const invalidAbi = ['function foo(uint256 duration) external'];

    const invalidAbiInterfaceId = getInterfaceId(invalidAbi);

    const invalid = await protocolTimeManager.supportsInterface(
      invalidAbiInterfaceId,
    );

    assert.equal(
      invalid,
      false,
      'Expected protocol time manager to not support incorrect interface',
    );
  });

  async function setProtocolStartIn(time: number): Promise<number> {
    const block = await ethers.provider.getBlock('latest').then(b => {
      if (!b) throw new Error('block undefined');
      return b;
    });

    await protocolTimeManager.setProtocolStart(block.timestamp + time);

    return protocolTimeManager.getStart().then(Number);
  }

  async function startProtocol() {
    const start = await setProtocolStartIn(100);
    await increaseTo(start);
    const setTimeSinceStart = async (time: number) => {
      return increaseTo(start + time);
    };
    return { start, setTimeSinceStart };
  }

  async function checkCycle(cycle: number) {
    const currentCycle = await protocolTimeManager.getCurrentCycle();
    assert.equal(Number(currentCycle.iteration), cycle);
  }

  async function checkPeriod(period: number) {
    const currentPeriod = await protocolTimeManager.getCurrentPeriod();
    assert.equal(Number(currentPeriod), period);
  }

  async function checkTime(cycle: number, period: number) {
    const [currentCycle, currentPeriod] = await protocolTimeManager.getTime();
    assert.equal(Number(currentCycle), cycle);
    assert.equal(Number(currentPeriod), period);
  }
});
