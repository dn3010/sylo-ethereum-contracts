import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { deployContracts } from './utils';
import { expect, assert } from 'chai';
import { SyloContracts } from '../common/contracts';
import {
  Directory,
  StakingOrchestrator,
  ProtocolTimeManager,
} from '../typechain-types';
import { getInterfaceId } from './utils';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

describe('Directory', () => {
  let contracts: SyloContracts;
  let directory: Directory;
  let stakingOrchestator: StakingOrchestrator;
  let protocolTimeManager: ProtocolTimeManager;
  let accounts: Signer[];
  let nodeOne: Signer;

  beforeEach(async () => {
    contracts = await deployContracts();
    accounts = await ethers.getSigners();
    nodeOne = accounts[1];
    directory = contracts.directory;
    stakingOrchestator = contracts.stakingOrchestrator;
    protocolTimeManager = contracts.protocolTimeManager;
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
    await startProtocol();
    await expect(directory.joinNextDirectory()).to.be.revertedWithCustomError(
      directory,
      'CannotJoinDirectoryWithZeroStake',
    );
  });

  it('cannot join same directory twice', async () => {
    await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    await expect(
      directory.connect(nodeOne).joinNextDirectory(),
    ).to.be.revertedWithCustomError(directory, 'StakeeAlreadyJoinedDirectory');
  });

  it('should be able to scan after joining directory', async () => {
    const { setTimeSinceStart } = await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    await setTimeSinceStart(110);
    const address = await directory.scan(0);
    assert.equal(address, await nodeOne.getAddress());
  });

  it('should be able to scan with period id after joining directory', async () => {
    await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    const address = await directory.scanWithTime(0, 1, 1);
    assert.equal(address, await nodeOne.getAddress());
  });

  it('should be able to scan empty directory', async () => {
    await startProtocol();
    const address = await directory.scan(0);
    assert.equal(address.toString(), ethers.ZeroAddress);
  });

  it('should be able to scan for different staking periods', async () => {
    let address: string;
    const { setTimeSinceStart } = await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(150);

    address = await directory.scan(0);
    assert.equal(address, await nodeOne.getAddress());

    await setTimeSinceStart(500);

    address = await directory.scan(0);
    assert.equal(address, ethers.ZeroAddress);
  });

  it('node joins next reward cycle', async () => {
    let address: string;
    const { setTimeSinceStart } = await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(150);

    address = await directory.scan(0);
    assert.equal(address, await nodeOne.getAddress());

    await setTimeSinceStart(850);

    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(950);

    address = await directory.scan(0);
    assert.equal(address, await nodeOne.getAddress());

    await setTimeSinceStart(1050);

    address = await directory.scan(0);
    assert.equal(address, ethers.ZeroAddress);

    await setTimeSinceStart(1950);
    await directory.connect(nodeOne).joinNextDirectory();

    await setTimeSinceStart(2050);

    address = await directory.scan(0);
    assert.equal(address, await nodeOne.getAddress());
  });

  it('should be able to scan for same staking period', async () => {
    let address: string;
    const { setTimeSinceStart } = await startProtocol();
    await stakingOrchestator.syloStakeAdded(nodeOne, ethers.ZeroAddress, 1000);
    await directory.connect(nodeOne).joinNextDirectory();
    address = await directory.scanWithTime(0, 1, 1);
    assert.equal(address, await nodeOne.getAddress());

    await setTimeSinceStart(500);

    address = await directory.scanWithTime(0, 1, 1);
    assert.equal(address, await nodeOne.getAddress());
  });

  it('should correctly scan accounts based on their stake proportions', async () => {
    const { setTimeSinceStart } = await startProtocol();
    for (let i = 0; i < 5; i++) {
      await stakingOrchestator.syloStakeAdded(
        await accounts[i].getAddress(),
        ethers.ZeroAddress,
        1,
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
      const address = await directory.scan(points[i]);
      assert.equal(
        address,
        await accounts[i].getAddress(),
        'Expected scan to return correct result',
      );

      // check scan with staking period
      const addressWithEpochId = await directory.scanWithTime(points[i], 1, 1);
      assert.equal(
        addressWithEpochId,
        await accounts[i].getAddress(),
        'Expected scan with staking period to return correct result',
      );
    }

    await setTimeSinceStart(1100);

    for (let i = 0; i < 5; i++) {
      // check scan
      const address = await directory.scan(points[i]);
      assert.equal(
        address,
        ethers.ZeroAddress,
        'Expected scan to return zero address',
      );

      // check scan with staking period
      const addressWithEpochId = await directory.scanWithTime(points[i], 2, 1);
      assert.equal(
        addressWithEpochId,
        ethers.ZeroAddress,
        'Expected scan with staking period to return zero address',
      );
    }
  });

  it('should correctly scan with different staking period ids', async () => {
    const { setTimeSinceStart } = await startProtocol();

    async function checkScanWithStakingPeriod(
      nodeAddress: string,
      pointValue: string,
      requestRewardCycle: number,
      requestStakingPeriod: number,
    ) {
      const address = await directory.scanWithTime(
        pointValue,
        requestRewardCycle,
        requestStakingPeriod,
      );
      assert.equal(
        address.toString(),
        nodeAddress,
        `Expected scan with staking period id to return correct address ${nodeAddress} for epoch ${requestStakingPeriod}`,
      );
    }

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
    await checkScanWithStakingPeriod(
      await accounts[0].getAddress(),
      point.toString(),
      1,
      1,
    );

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 2n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      1,
      1,
    );

    // check point of node 2, staking period 1
    point = 2n ** 128n - 1n;
    await checkScanWithStakingPeriod(
      await accounts[2].getAddress(),
      point.toString(),
      1,
      1,
    );

    // In staking period 2, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 2
    point = (2n ** 128n - 1n) / 4n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      1,
      2,
    );

    // check point of node 3, staking period 2
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await checkScanWithStakingPeriod(
      await accounts[3].getAddress(),
      point.toString(),
      1,
      2,
    );

    // check staking period 4 - empty directory
    await checkScanWithStakingPeriod(ethers.ZeroAddress, '10000000', 1, 4);
  });

  it('should correctly scan accounts based on their stake proportions over multiple reward cycles', async () => {
    const { setTimeSinceStart } = await startProtocol();
    for (let i = 0; i < 5; i++) {
      await stakingOrchestator.syloStakeAdded(
        await accounts[i].getAddress(),
        ethers.ZeroAddress,
        1,
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
      const address = await directory.scan(points[i]);
      assert.equal(
        address,
        await accounts[i].getAddress(),
        'Expected scan to return correct result',
      );

      // check scan with staking period
      const addressWithStakingPeriod = await directory.scanWithTime(
        points[i],
        1,
        1,
      );
      assert.equal(
        addressWithStakingPeriod,
        await accounts[i].getAddress(),
        'Expected scan with staking period to return correct result',
      );
    }

    await setTimeSinceStart(1100);

    for (let i = 0; i < 5; i++) {
      // check scan
      const address = await directory.scan(points[i]);
      assert.equal(
        address,
        ethers.ZeroAddress,
        'Expected scan to return zero address',
      );

      // check scan with staking period
      const addressWithStakingPeriod = await directory.scanWithTime(
        points[i],
        2,
        1,
      );
      assert.equal(
        addressWithStakingPeriod,
        ethers.ZeroAddress,
        'Expected scan with staking period to return zero address',
      );
    }
  });

  it('should correctly scan with different staking period ids over multiple reward cycles', async () => {
    const { setTimeSinceStart } = await startProtocol();

    async function checkScanWithStakingPeriod(
      nodeAddress: string,
      pointValue: string,
      requestRewardCycle: number,
      requestStakingPeriod: number,
    ) {
      const address = await directory.scanWithTime(
        pointValue,
        requestRewardCycle,
        requestStakingPeriod,
      );
      assert.equal(
        address.toString(),
        nodeAddress,
        `Expected scan with staking period id to return correct address ${nodeAddress} for epoch ${requestStakingPeriod}`,
      );
    }

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
    await checkScanWithStakingPeriod(
      await accounts[0].getAddress(),
      point.toString(),
      1,
      1,
    );

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 2n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      1,
      1,
    );

    // check point of node 2, staking period 1
    point = 2n ** 128n - 1n;
    await checkScanWithStakingPeriod(
      await accounts[2].getAddress(),
      point.toString(),
      1,
      1,
    );

    // In staking period 2, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 2
    point = (2n ** 128n - 1n) / 4n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      1,
      2,
    );

    // check point of node 3, staking period 2
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await checkScanWithStakingPeriod(
      await accounts[3].getAddress(),
      point.toString(),
      1,
      2,
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
    await checkScanWithStakingPeriod(
      await accounts[0].getAddress(),
      point.toString(),
      2,
      0,
    );

    // check point of node 1, staking period 0
    point = (2n ** 128n - 1n) / 2n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      2,
      0,
    );

    // check point of node 2, staking period 0
    point = 2n ** 128n - 1n;
    await checkScanWithStakingPeriod(
      await accounts[2].getAddress(),
      point.toString(),
      2,
      0,
    );

    // In staking period 1, the directory tree will be
    //
    // 300 | 450   | 500   | 300   | 450
    // 0%  | 15%   | 37.5% | 62.5% | 77.5%

    // check point of node 1, staking period 1
    point = (2n ** 128n - 1n) / 4n;
    await checkScanWithStakingPeriod(
      await accounts[1].getAddress(),
      point.toString(),
      2,
      1,
    );

    // check point of node 3, staking period 1
    point = ((2n ** 128n - 1n) / 4n) * 3n;
    await checkScanWithStakingPeriod(
      await accounts[3].getAddress(),
      point.toString(),
      2,
      1,
    );

    // check staking period 4 - empty directory
    await checkScanWithStakingPeriod(ethers.ZeroAddress, '10000000', 1, 4);
  });

  it('directory supports correct interfaces', async () => {
    const abi = [
      'function scan(uint128 point) external returns (address)',
      'function scanWithTime(uint128 point, uint256 rewardCycleId, uint256 stakingPeriodId) external returns (address)',
      'function joinNextDirectory() external',
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
});
