import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { deployContracts, ProtocolTimeManagerUtilities } from './utils';
import { expect, assert } from 'chai';
import { SyloContracts } from '../common/contracts';
import {
  Directory,
  StakingOrchestrator,
  ProtocolTimeManager,
} from '../typechain-types';
import { getInterfaceId, getTimeManagerUtil } from './utils';

describe('Directory', () => {
  let contracts: SyloContracts;
  let directory: Directory;
  let stakingOrchestator: StakingOrchestrator;
  let protocolTimeManager: ProtocolTimeManager;
  let accounts: Signer[];
  let nodeOne: Signer;
  let nodeTwo: Signer;
  let nodeThree: Signer;

  let timeManagerUtil: ProtocolTimeManagerUtilities;

  beforeEach(async () => {
    contracts = await deployContracts();
    accounts = await ethers.getSigners();
    nodeOne = accounts[1];
    nodeTwo = accounts[2];
    nodeThree = accounts[3];
    directory = contracts.directory;
    stakingOrchestator = contracts.stakingOrchestrator;
    protocolTimeManager = contracts.protocolTimeManager;

    timeManagerUtil = getTimeManagerUtil(protocolTimeManager);

    await stakingOrchestator.grantRole(
      await stakingOrchestator.onlyStakingManager(),
      accounts[0].getAddress(),
    );

    await stakingOrchestator.setCapacityPenaltyFactor(1);
  });

  it('cannot initialize directory more than once', async () => {
    await expect(
      directory.initialize(
        await stakingOrchestator.getAddress(),
        await protocolTimeManager.getAddress(),
      ),
    ).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('cannot initialize directory with empty StakingOrchestrator address', async () => {
    const directoryFactory = await ethers.getContractFactory('Directory');
    const directoryTemp = await directoryFactory.deploy();

    await expect(
      directoryTemp.initialize(
        ethers.ZeroAddress,
        await protocolTimeManager.getAddress(),
      ),
    ).to.be.revertedWithCustomError(
      directoryTemp,
      'CannotInitialiseWithZeroStakingOrchestratorAddress',
    );
  });

  it('cannot initialize directory with empty ProtocolTimeManager address', async () => {
    const directoryFactory = await ethers.getContractFactory('Directory');
    const directoryTemp = await directoryFactory.deploy();

    await expect(
      directoryTemp.initialize(
        await stakingOrchestator.getAddress(),
        ethers.ZeroAddress,
      ),
    ).to.be.revertedWithCustomError(
      directoryTemp,
      'CannotInitialiseWithZeroProtocolTimeManagerAddress',
    );
  });

  it('cannot join directory without stake', async () => {
    await timeManagerUtil.startProtocol();
    await expect(directory.joinNextDirectory()).to.be.revertedWithCustomError(
      directory,
      'CannotJoinDirectoryWithZeroStake',
    );
  });

  it('cannot join same directory twice', async () => {
    await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    await expect(
      directory.connect(nodeOne).joinNextDirectory(),
    ).to.be.revertedWithCustomError(directory, 'NodeAlreadyJoinedDirectory');
  });

  it('should be able to scan after joining directory', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    await setTimeSinceStart(110);

    expect(await directory.getDirectoryStake(1, 1, nodeOne)).to.equal(1000n);

    await testScan(BigInt(0), await nodeOne.getAddress());
  });

  it('should be able to scan with period id after joining directory', async () => {
    await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();

    await testScanWithTime(
      BigInt(0),
      BigInt(1),
      BigInt(1),
      await nodeOne.getAddress(),
    );
  });

  it('should be able to scan empty directory', async () => {
    await timeManagerUtil.startProtocol();
    await testScan(BigInt(0), ethers.ZeroAddress);
  });

  it('should be able to scan for different staking periods', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(150);

    await testScan(BigInt(0), await nodeOne.getAddress());

    await setTimeSinceStart(500);

    await testScan(BigInt(0), ethers.ZeroAddress);
  });

  it('node joins next cycle at the final period', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);

    // Cycle duration -> 1000
    // Period duration -> 100

    // Join Cycle 1, Period 2
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(150);

    await testScan(BigInt(0), await nodeOne.getAddress());

    await setTimeSinceStart(850);

    // Join Cycle 1, Period 9
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(950);

    // Test that node has joined final staking period
    await testScan(BigInt(0), await nodeOne.getAddress());

    await setTimeSinceStart(1050);

    // Test that node did not join for Period 0
    // of next Cycle, Cycle 2
    await testScan(BigInt(0), ethers.ZeroAddress);

    await setTimeSinceStart(1950);

    // Join Cycle 3, Period 0
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(2050);

    // Test that node joined for Period 0
    // of next Cycle, Cycle 3
    await testScan(BigInt(0), await nodeOne.getAddress());
  });

  it('should be able to scan for previous periods', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    await stakingOrchestator.syloStakeAdded(
      nodeOne,
      nodeOne.getAddress(),
      1000,
    );
    await stakingOrchestator.syloStakeAdded(
      nodeTwo,
      nodeTwo.getAddress(),
      1000,
    );
    await stakingOrchestator.syloStakeAdded(
      nodeThree,
      nodeThree.getAddress(),
      1000,
    );

    const threePoints = (2n ** 128n - 1n) / 3n;
    const twoPoints = (2n ** 128n - 1n) / 2n;

    const nodeTwoPointPeriodOne = threePoints + 1n;
    const nodeThreePointPeriodOne = threePoints * 2n + 1n;

    const nodeTwoPointPeriodTwo = twoPoints + 1n;

    // All three nodes join the next directory so
    // should be able to be scanned to
    await directory.connect(nodeOne).joinNextDirectory();
    await directory.connect(nodeTwo).joinNextDirectory();
    await directory.connect(nodeThree).joinNextDirectory();

    await testScanWithTime(
      BigInt(0),
      BigInt(1),
      BigInt(1),
      await nodeOne.getAddress(),
    );

    await testScanWithTime(
      nodeTwoPointPeriodOne,
      BigInt(1),
      BigInt(1),
      await nodeTwo.getAddress(),
    );

    await testScanWithTime(
      nodeThreePointPeriodOne,
      BigInt(1),
      BigInt(1),
      await nodeThree.getAddress(),
    );

    await setTimeSinceStart(150);

    // Nodes one and two join the next directory, however
    // node three should still be scanned to from the prior
    // period
    await directory.connect(nodeOne).joinNextDirectory();
    await directory.connect(nodeTwo).joinNextDirectory();

    await testScanWithTime(
      BigInt(0),
      BigInt(1),
      BigInt(2),
      await nodeOne.getAddress(),
    );

    await testScanWithTime(
      nodeTwoPointPeriodTwo,
      BigInt(1),
      BigInt(2),
      await nodeTwo.getAddress(),
    );

    await testScanWithTime(
      nodeThreePointPeriodOne,
      BigInt(1),
      BigInt(1),
      await nodeThree.getAddress(),
    );

    await setTimeSinceStart(250);

    // Only node one joins the next directory and
    // so is the only node scanned to for that period
    await directory.connect(nodeOne).joinNextDirectory();

    await testScanWithTime(
      BigInt(0),
      BigInt(1),
      BigInt(3),
      await nodeOne.getAddress(),
    );

    await testScanWithTime(
      nodeTwoPointPeriodTwo,
      BigInt(1),
      BigInt(3),
      await nodeOne.getAddress(),
    );

    await testScanWithTime(
      nodeTwoPointPeriodTwo,
      BigInt(1),
      BigInt(2),
      await nodeTwo.getAddress(),
    );
  });

  it('should correctly scan accounts based on their stake proportions', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    for (let i = 0; i < 5; i++) {
      await stakingOrchestator.syloStakeAdded(
        await accounts[i].getAddress(),
        ethers.ZeroAddress,
        100,
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    await setTimeSinceStart(110);

    const fifthPoint = (2n ** 128n - 1n) / 5n;
    const points = [
      0n,
      fifthPoint + 1n,
      fifthPoint * 2n + 2n,
      fifthPoint * 3n + 3n,
      fifthPoint * 4n + 4n,
    ];

    for (let i = 0; i < 5; i++) {
      // check scan
      await testScan(points[i], await accounts[i].getAddress());

      await testScanWithTime(
        points[i],
        BigInt(1),
        BigInt(1),
        await accounts[i].getAddress(),
      );
    }

    await setTimeSinceStart(1100);

    for (let i = 0; i < 5; i++) {
      // check scan
      await testScan(points[i], ethers.ZeroAddress);

      await testScanWithTime(
        points[i],
        BigInt(2),
        BigInt(1),
        ethers.ZeroAddress,
      );
    }
  });

  it('should correctly scan with different staking period ids', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();

    // process staking period 1
    const amountPeriodOne = [250, 350, 400];
    for (let i = 0; i < amountPeriodOne.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodOne[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    await setTimeSinceStart(150);

    // process staking period 1
    const amountPeriodTwo = [50, 100, 100, 300, 450];
    for (let i = 0; i < amountPeriodTwo.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodTwo[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    // check point of node 0, staking period 1
    let point = (2n ** 128n - 1n) / 8n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[0].getAddress(),
    );

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 2n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[1].getAddress(),
    );

    // check point of node 2, staking period 1
    point = 2n ** 128n - 1n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[2].getAddress(),
    );

    // In staking period 2, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 2
    point = (2n ** 128n - 1n) / 4n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(2),
      await accounts[1].getAddress(),
    );

    // check point of node 3, staking period 2
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(2),
      await accounts[3].getAddress(),
    );

    // check staking period 4 - empty directory
    await testScanWithTime(
      BigInt(10000000),
      BigInt(1),
      BigInt(4),
      ethers.ZeroAddress,
    );
  });

  it('should correctly scan accounts based on their stake proportions over multiple reward cycles', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();
    for (let i = 0; i < 5; i++) {
      await stakingOrchestator.syloStakeAdded(
        await accounts[i].getAddress(),
        ethers.ZeroAddress,
        100,
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    await setTimeSinceStart(110);

    const fifthPoint = (2n ** 128n - 1n) / 5n;
    const points = [
      0n,
      fifthPoint + 1n,
      fifthPoint * 2n + 2n,
      fifthPoint * 3n + 3n,
      fifthPoint * 4n + 4n,
    ];

    for (let i = 0; i < 5; i++) {
      // check scan
      await testScan(points[i], await accounts[i].getAddress());

      // check scan with staking period
      await testScanWithTime(
        points[i],
        BigInt(1),
        BigInt(1),
        await accounts[i].getAddress(),
      );
    }

    await setTimeSinceStart(1100);

    for (let i = 0; i < 5; i++) {
      // check scan
      await testScan(points[i], ethers.ZeroAddress);

      // check scan with staking period
      await testScanWithTime(
        points[i],
        BigInt(2),
        BigInt(1),
        ethers.ZeroAddress,
      );
    }
  });

  it('should correctly scan with different staking period ids over multiple reward cycles', async () => {
    const { setTimeSinceStart } = await timeManagerUtil.startProtocol();

    /*
    Reward Cycle 1
    */

    // process staking period 1
    let amountPeriodOne: number[];
    amountPeriodOne = [250, 350, 400];
    for (let i = 0; i < amountPeriodOne.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodOne[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    await setTimeSinceStart(150);

    // process staking period 2, reward cycle 1
    const amountPeriodTwo = [50, 100, 100, 300, 450];
    for (let i = 0; i < amountPeriodTwo.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodTwo[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    // check point of node 0, staking period 1
    let point: bigint;
    point = (2n ** 128n - 1n) / 8n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[0].getAddress(),
    );

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 2n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[1].getAddress(),
    );

    // check point of node 2, staking period 1
    point = 2n ** 128n - 1n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(1),
      await accounts[2].getAddress(),
    );

    // In staking period 2, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 2
    point = (2n ** 128n - 1n) / 4n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(2),
      await accounts[1].getAddress(),
    );

    // check point of node 3, staking period 2
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await testScanWithTime(
      point,
      BigInt(1),
      BigInt(2),
      await accounts[3].getAddress(),
    );

    /*
    Reward Cycle 2
    */

    await setTimeSinceStart(950);

    // process staking period 1
    const amountPeriodZero = [250, 350, 400];
    for (let i = 0; i < amountPeriodZero.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodZero[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    await setTimeSinceStart(1050);

    // process staking period 2
    amountPeriodOne = [50, 100, 100, 300, 450];
    for (let i = 0; i < amountPeriodTwo.length; i++) {
      await stakingOrchestator.syloStakeAdded(
        accounts[i],
        ethers.ZeroAddress,
        amountPeriodTwo[i],
      );
      await directory.connect(accounts[i]).joinNextDirectory();
    }

    // check point of node 0, staking period 0
    point = (2n ** 128n - 1n) / 8n;
    await testScanWithTime(
      point,
      BigInt(2),
      BigInt(0),
      await accounts[0].getAddress(),
    );

    // check point of node 1, staking period 0
    point = (2n ** 128n - 1n) / 2n;
    await testScanWithTime(
      point,
      BigInt(2),
      BigInt(0),
      await accounts[1].getAddress(),
    );

    // check point of node 2, staking period 0
    point = 2n ** 128n - 1n;
    await testScanWithTime(
      point,
      BigInt(2),
      BigInt(0),
      await accounts[2].getAddress(),
    );

    // In staking period 1, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 4n;
    await testScanWithTime(
      point,
      BigInt(2),
      BigInt(1),
      await accounts[1].getAddress(),
    );

    // check point of node 3, staking period 1
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await testScanWithTime(
      point,
      BigInt(2),
      BigInt(1),
      await accounts[3].getAddress(),
    );

    // check staking period 4 - empty directory
    await testScanWithTime(
      BigInt(10000000),
      BigInt(1),
      BigInt(4),
      ethers.ZeroAddress,
    );
  });

  it('can get directory entries', async () => {
    await timeManagerUtil.startProtocol();

    for (let i = 0; i < 5; i++) {
      await stakingOrchestator.syloStakeAdded(
        await accounts[i].getAddress(),
        ethers.ZeroAddress,
        100,
      );

      await directory.connect(accounts[i]).joinNextDirectory();
    }

    const entries = await directory.getEntries(1, 1);

    for (let i = 0; i < 5; i++) {
      expect(entries[0][i]).to.equal(await accounts[i].getAddress());
      expect(entries[1][i]).to.equal(100 + 100 * i);
    }

    console.log(entries);
  });

  it('directory supports correct interfaces', async () => {
    const abi = [
      'function scan(uint128 point) external returns (address)',
      'function scanWithTime(uint128 point, uint256 rewardCycleId, uint256 stakingPeriodId) external returns (address)',
      'function joinNextDirectory() external',
      'function getDirectoryStake(uint256 cycle, uint256 period, address node) external view returns (uint256)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await directory.supportsInterface(interfaceId);

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

  const testScan = async function (point: bigint, expectedAddress: string) {
    expect(await directory.scan(point)).to.equal(expectedAddress);
  };

  const testScanWithTime = async function (
    point: bigint,
    cycle: bigint,
    period: bigint,
    expectedAddress: string,
  ) {
    expect(await directory.scanWithTime(point, cycle, period)).to.equal(
      expectedAddress,
    );
  };
});
