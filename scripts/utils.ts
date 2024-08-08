import { ethers } from 'ethers';
import * as Contracts from '../common/contracts';
import contractAddress from '../deployments/localhost_deployment_phase_two.json';
import { Permission } from '../common/enum';

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

  await contracts.seekerStatsOracle
    .connect(oracle)
    .registerSeekerRestricted({
      seekerId: tokenId,
      rank: 100,
      attrReactor: 10,
      attrCores: 10,
      attrDurability: 10,
      attrSensors: 10,
      attrStorage: 10,
      attrChip: 10,
    })
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
