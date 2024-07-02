import { ethers } from 'hardhat';
import { SeekerStatsOracle } from '../../typechain-types';
import { SyloContracts } from '../../common/contracts';
import { Signer } from 'ethers';
import { expect, assert } from 'chai';
import { deployContracts, getInterfaceId } from '../utils';

export class Seeker {
  constructor(
    public seekerId: number,
    public rank: number,
    public attrReactor: number,
    public attrCores: number,
    public attrDurability: number,
    public attrSensors: number,
    public attrStorage: number,
    public attrChip: number,
  ) {}
}

describe('Seeker Stats', () => {
  let accounts: Signer[];
  let contracts: SyloContracts;
  let seekerStatsOracle: SeekerStatsOracle;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    contracts = await deployContracts();
    seekerStatsOracle = contracts.seekerStatsOracle;
    await seekerStatsOracle.setOracle(await accounts[19].getAddress());
  });

  it('cannot initialize seeker stats oracle with invalid arguemnts', async () => {
    const factory = await ethers.getContractFactory('SeekerStatsOracle');
    const seekerStatsOracleTemp = await factory.deploy();

    await expect(
      seekerStatsOracleTemp.initialize(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      seekerStatsOracleTemp,
      'OracleAddressCannotBeNil',
    );
  });

  it('cannot initialize seeker stats oracle more than once', async () => {
    await expect(
      seekerStatsOracle.initialize(await accounts[19].getAddress()),
    ).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('can set oracle account as owner', async () => {
    assert.equal(
      await seekerStatsOracle.oracle(),
      await accounts[19].getAddress(),
    );

    const oracle = await accounts[18].getAddress();
    await expect(seekerStatsOracle.setOracle(oracle))
      .to.emit(seekerStatsOracle, 'OracleUpdated')
      .withArgs(oracle);
    assert.equal(
      await seekerStatsOracle.oracle(),
      await accounts[18].getAddress(),
    );
  });

  it('cannot set oracle account as non-owner', async () => {
    await expect(
      seekerStatsOracle
        .connect(accounts[19])
        .setOracle(await accounts[18].getAddress()),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('cannot set oracle account as zero address', async () => {
    await expect(
      seekerStatsOracle.setOracle(ethers.ZeroAddress),
    ).to.be.revertedWithCustomError(
      seekerStatsOracle,
      'OracleAddressCannotBeNil',
    );
  });

  it('can register seeker', async () => {
    const seeker = createRandomSeeker();

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await accounts[19].signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );

    await expect(seekerStatsOracle.registerSeeker(seeker, signature))
      .to.emit(seekerStatsOracle, 'SeekerStatsUpdated')
      .withArgs(
        seeker.seekerId,
        seeker.attrReactor,
        seeker.attrCores,
        seeker.attrDurability,
        seeker.attrSensors,
        seeker.attrStorage,
        seeker.attrChip,
      );
  });

  it('can register seeker restricted', async () => {
    const seeker = createRandomSeeker();

    await expect(
      seekerStatsOracle.connect(accounts[19]).registerSeekerRestricted(seeker),
    )
      .to.emit(seekerStatsOracle, 'SeekerStatsUpdated')
      .withArgs(
        seeker.seekerId,
        seeker.attrReactor,
        seeker.attrCores,
        seeker.attrDurability,
        seeker.attrSensors,
        seeker.attrStorage,
        seeker.attrChip,
      );
  });

  it('cannot register seeker restricted from non-oracle account', async () => {
    const seeker = createRandomSeeker();

    await expect(
      seekerStatsOracle.registerSeekerRestricted(seeker),
    ).to.be.revertedWithCustomError(
      seekerStatsOracle,
      'SenderMustBeOracelAccount',
    );
  });

  it('cannot register seeker from non-oracle account', async () => {
    const seeker = createRandomSeeker();

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const signature = await accounts[18].signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await expect(
      seekerStatsOracle.registerSeeker(seeker, signature),
    ).to.be.revertedWithCustomError(
      seekerStatsOracle,
      'InvalidSignatureForSeekerProof',
    );
  });

  it('can update registered seeker', async () => {
    const seeker = createRandomSeeker();
    const seekerTwo = createRandomSeeker();
    seekerTwo.seekerId = seeker.seekerId;
    seekerTwo.rank = seeker.rank;

    const proofMessage = await seekerStatsOracle.createProofMessage(seeker);
    const proofMessageTwo = await seekerStatsOracle.createProofMessage(
      seekerTwo,
    );

    const signature = await accounts[19].signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    const signatureTwo = await accounts[19].signMessage(
      Buffer.from(proofMessageTwo.slice(2), 'hex'),
    );

    await seekerStatsOracle.registerSeeker(seeker, signature);

    const fetchedSeeker = await seekerStatsOracle.getSeekerStats(
      seeker.seekerId,
    );
    const newSeekerOne = new Seeker(
      Number(fetchedSeeker[0]),
      Number(fetchedSeeker[1]),
      Number(fetchedSeeker[2]),
      Number(fetchedSeeker[3]),
      Number(fetchedSeeker[4]),
      Number(fetchedSeeker[5]),
      Number(fetchedSeeker[6]),
      Number(fetchedSeeker[7]),
    );

    assert.equal(Number(fetchedSeeker.seekerId), seeker.seekerId);

    await seekerStatsOracle.registerSeeker(seekerTwo, signatureTwo);

    const fetchedSeekerTwo = await seekerStatsOracle.getSeekerStats(
      seeker.seekerId,
    );
    const newSeekerTwo = new Seeker(
      Number(fetchedSeekerTwo[0]),
      Number(fetchedSeekerTwo[1]),
      Number(fetchedSeekerTwo[2]),
      Number(fetchedSeekerTwo[3]),
      Number(fetchedSeekerTwo[4]),
      Number(fetchedSeekerTwo[5]),
      Number(fetchedSeekerTwo[6]),
      Number(fetchedSeekerTwo[7]),
    );

    assert.equal(compareSeekers(newSeekerOne, newSeekerTwo), false);
  });

  it('cannot register seeker from with invalid proof', async () => {
    const seeker = createRandomSeeker();

    const proofMessage = 'invalid message';
    const signature = await accounts[18].signMessage(
      Buffer.from(proofMessage.slice(2), 'hex'),
    );
    await expect(
      seekerStatsOracle.registerSeeker(seeker, signature),
    ).to.be.revertedWithCustomError(
      seekerStatsOracle,
      'InvalidSignatureForSeekerProof',
    );
  });

  it('cannot calculate converage with unregistered seeker', async () => {
    const seeker = createRandomSeeker();

    await expect(seekerStatsOracle.calculateAttributeCoverage([seeker]))
      .to.be.revertedWithCustomError(seekerStatsOracle, 'SeekerNotRegistered')
      .withArgs(seeker.seekerId);
  });

  it('can calculate converage with registered seeker', async () => {
    const seekerList = await createAndRegisterSeeker(1);

    const attributeConverageExpected = calculateAttributesCoverage(seekerList);
    const attributeCoverage =
      await seekerStatsOracle.calculateAttributeCoverage(seekerList);
    const formatedCoverage = ethers.formatEther(attributeCoverage);

    assert.equal(
      Number(formatedCoverage).toFixed(0),
      attributeConverageExpected.toFixed(0),
    );
  });

  it('can calculate converage with multiple registered seeker', async () => {
    const seekerList = await createAndRegisterSeeker(5);

    const attributeConverageExpected = calculateAttributesCoverage(seekerList);
    const attributeCoverage =
      await seekerStatsOracle.calculateAttributeCoverage(seekerList);
    const formatedCoverage = ethers.formatEther(attributeCoverage);

    assert.equal(
      Number(formatedCoverage).toFixed(0),
      attributeConverageExpected.toFixed(0),
    );
  });

  it('seeker stats oracle supports correct interfaces', async () => {
    const abi = [
      'function setOracle(address _seekerStatsOracleAccount) external',
      'function createProofMessage((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) calldata seeker) external pure returns (bytes memory)',
      'function registerSeekerRestricted((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) calldata seeker) external',
      'function registerSeeker((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) calldata seeker, bytes calldata signature) external',
      'function calculateAttributeCoverage((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)[] calldata seekersList) external view returns (int256)',
      'function isSeekerRegistered((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) calldata seeker) external view returns (bool)',
      'function getSeekerStats(uint256 seekerId) external view returns ((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256) memory)',
    ];

    const interfaceId = getInterfaceId(abi);

    const supports = await seekerStatsOracle.supportsInterface(interfaceId);

    assert.equal(
      supports,
      true,
      'Expected seeker stats oracle to support correct interface',
    );
  });

  function calculateAttributesCoverage(seekers: Seeker[]): number {
    const angleRadians = Math.sin((2 * Math.PI) / 6 + 2 * Math.PI);

    let coverage = 0;

    let totalReactor = 0;
    let totalCores = 0;
    let totalDurability = 0;
    let totalSensors = 0;
    let totalStorage = 0;
    let totalChip = 0;

    for (const seeker of seekers) {
      const {
        attrReactor,
        attrCores,
        attrDurability,
        attrSensors,
        attrStorage,
        attrChip,
      } = seeker;

      totalReactor += attrReactor;
      totalCores += attrCores;
      totalDurability += attrDurability;
      totalSensors += attrSensors;
      totalStorage += attrStorage;
      totalChip += attrChip;
    }

    coverage += (totalReactor * angleRadians * totalCores) / 2;
    coverage += (totalCores * angleRadians * totalDurability) / 2;
    coverage += (totalDurability * angleRadians * totalSensors) / 2;
    coverage += (totalSensors * angleRadians * totalStorage) / 2;
    coverage += (totalStorage * angleRadians * totalChip) / 2;
    coverage += (totalChip * angleRadians * totalReactor) / 2;

    return coverage;
  }

  async function createAndRegisterSeeker(amount: number): Promise<Seeker[]> {
    const seekerList: Seeker[] = [];
    for (let i = 0; i < amount; i++) {
      const newSeeker = createRandomSeeker();
      const proofMessage = await seekerStatsOracle.createProofMessage(
        newSeeker,
      );
      const signature = await accounts[19].signMessage(
        Buffer.from(proofMessage.slice(2), 'hex'),
      );
      seekerList.push(newSeeker);
      await seekerStatsOracle.registerSeeker(newSeeker, signature);
    }

    return seekerList;
  }

  function compareSeekers(seeker1: Seeker, seeker2: Seeker): boolean {
    return (
      seeker1.seekerId === seeker2.seekerId &&
      seeker1.rank === seeker2.rank &&
      seeker1.attrReactor === seeker2.attrReactor &&
      seeker1.attrCores === seeker2.attrCores &&
      seeker1.attrDurability === seeker2.attrDurability &&
      seeker1.attrSensors === seeker2.attrSensors &&
      seeker1.attrStorage === seeker2.attrStorage &&
      seeker1.attrChip === seeker2.attrChip
    );
  }
});

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; // The maximum is inclusive and the minimum is inclusive
}

export function createRandomSeeker(): Seeker {
  const seekerId = getRandomInt(1, 60000);
  const rank = getRandomInt(1, 100);
  const attrReactor = getRandomInt(1, 30);
  const attrCores = getRandomInt(1, 30);
  const attrDurability = getRandomInt(1, 30);
  const attrSensors = getRandomInt(1, 30);
  const attrStorage = getRandomInt(1, 30);
  const attrChip = getRandomInt(1, 30);

  return new Seeker(
    seekerId,
    rank,
    attrReactor,
    attrCores,
    attrDurability,
    attrSensors,
    attrStorage,
    attrChip,
  );
}
