import { BigNumberish, ethers, Signer } from 'ethers';
import * as Contracts from '../common/contracts';
import contractAddress from '../deployments/localhost_deployment_phase_two.json';
import { Permission } from '../common/enum';
import { ITicketing } from '../typechain-types/contracts/payments';
import { IAuthorizedAccounts } from '../typechain-types';

export const MAX_WINNING_PROBABILITY = 2n ** 128n - 1n;

export type Node = {
  signer: ethers.Signer;
  publicEndPoint: string;
};

export type NodeConfig = {
  privateKey: string;
  publicEndpoint: string;
};

export type IncentivisingNodeConfig =
  | NodeConfig
  | {
      authorizedAccount: {
        address: string;
        description: string;
      };
    };

export async function updateFuturepassRegistrar(
  contracts: Contracts.SyloContracts,
  node: ethers.Signer,
): Promise<void> {
  await contracts.futurepassRegistrar
    .connect(node)
    .create(node.getAddress())
    .then(tx => tx.wait());
}

export async function addStake(
  contracts: Contracts.SyloContracts,
  node: ethers.Signer,
): Promise<void> {
  await contracts.syloToken
    .connect(node)
    .approve(contractAddress.syloStakingManager, ethers.parseEther('1000000'))
    .then(tx => tx.wait());

  await contracts.syloStakingManager
    .connect(node)
    .addStake(node.getAddress(), ethers.parseEther('100000'))
    .then(tx => tx.wait());
}

export async function addSeekerStake(
  contracts: Contracts.SyloContracts,
  nodeAccount: ethers.Signer,
  oracle: ethers.Signer,
  tokenId: number,
): Promise<void> {
  if (!(await contracts.seekers.exists(tokenId))) {
    await contracts.seekers
      .connect(nodeAccount)
      .mint(await nodeAccount.getAddress(), tokenId)
      .then(tx => tx.wait());
  }

  const seeker = {
    seekerId: tokenId,
    rank: 100,
    attrReactor: 10,
    attrCores: 10,
    attrDurability: 10,
    attrSensors: 10,
    attrStorage: 10,
    attrChip: 10,
  };

  const proofMessage = await contracts.seekerStatsOracle.createProofMessage(
    seeker,
  );

  const proof = await oracle.signMessage(
    Buffer.from(proofMessage.slice(2), 'hex'),
  );

  await contracts.seekerStakingManager
    .connect(nodeAccount)
    .stakeSeeker(nodeAccount.getAddress(), seeker, proof)
    .then(tx => tx.wait());
}

export async function registerNodes(
  contracts: Contracts.SyloContracts,
  nodes: Node,
): Promise<void> {
  if (nodes.publicEndPoint != '') {
    await contracts.registries
      .connect(nodes.signer)
      .register(nodes.publicEndPoint)
      .then(tx => tx.wait());
  }
}

export async function depositTicketing(
  contracts: Contracts.SyloContracts,
  incentivisedNode: ethers.Signer,
) {
  await contracts.syloToken
    .connect(incentivisedNode)
    .approve(contracts.deposits.getAddress(), ethers.parseEther('1000000000'))
    .then(tx => tx.wait());

  await contracts.deposits
    .connect(incentivisedNode)
    .depositEscrow(ethers.parseEther('100000'), incentivisedNode.getAddress())
    .then(tx => tx.wait());

  await contracts.deposits
    .connect(incentivisedNode)
    .depositPenalty(ethers.parseEther('100000'), incentivisedNode.getAddress())
    .then(tx => tx.wait());
}

export async function authorizeAccount(
  contracts: Contracts.SyloContracts,
  main: ethers.Signer,
  authorized: string,
) {
  await contracts.authorizedAccounts
    .connect(main)
    .authorizeAccount(authorized, [Permission.PersonalSign], {});
}

export async function createSignedTicket(
  contracts: Contracts.SyloContracts,
  sender: Signer,
  receiver: Signer,
  node: Signer,
) {
  const block = await sender.provider!.getBlock('latest');
  if (!block) {
    throw new Error('could not get latest block');
  }

  const [cycle] = await contracts.protocolTimeManager.getCurrentCycle();

  const redeemerRand = 1;

  const ticket: ITicketing.TicketStruct = {
    cycle: cycle,
    sender: await sender.getAddress(),
    receiver: await receiver.getAddress(),
    redeemer: await node.getAddress(),
    generationBlock: block.number,
    redeemerCommit: ethers.zeroPadBytes(
      createCommit(BigInt(block.number), redeemerRand),
      32,
    ),
  };

  const ticketHash = await contracts.ticketing.getTicketHash(ticket);

  const senderSig = createUserSignature(
    0,
    await sender.signMessage(ethers.getBytes(ticketHash)),
    ethers.ZeroAddress,
    {
      account: await sender.getAddress(),
      expiry: block.timestamp + 10000,
      proof: new Uint8Array(0),
      prefix: '',
      suffix: '',
      infixOne: '',
    },
  );

  const receiverSig = createUserSignature(
    0,
    await receiver.signMessage(ethers.getBytes(ticketHash)),
    ethers.ZeroAddress,
    {
      account: await receiver.getAddress(),
      expiry: block.timestamp + 10000,
      proof: new Uint8Array(0),
      prefix: '',
      suffix: '',
      infixOne: '',
    },
  );

  return {
    ticket,
    ticketHash,
    redeemerRand,
    senderSig,
    receiverSig,
  };
}

export function createCommit(
  generationBlock: bigint,
  rand: BigNumberish,
): string {
  return ethers.solidityPackedKeccak256(
    ['bytes32'],
    [
      ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [generationBlock, rand],
      ),
    ],
  );
}

function createUserSignature(
  sigType: number,
  signature: string,
  authorizedAccount: string,
  attachedAuthorizedAccount: IAuthorizedAccounts.AttachedAuthorizedAccountStruct,
): ITicketing.UserSignatureStruct {
  const newSig: ITicketing.UserSignatureStruct = {
    sigType: sigType,
    signature: signature,
    authorizedAccount: authorizedAccount,
    attachedAuthorizedAccount: attachedAuthorizedAccount,
  };

  return newSig;
}
