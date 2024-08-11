import { ethers } from 'ethers';
import contractAddresses from '../deployments/localhost_deployment_phase_two.json';
import nodesConfig from './nodes.json';
import * as Contracts from '../common/contracts';
import * as utils from './utils';

export async function main() {
  const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');

  const contracts = Contracts.connectContracts(contractAddresses, provider);

  const deployer = new ethers.Wallet(nodesConfig.deployerPK, provider);

  const latestBlock = await provider.getBlock('latest');
  if (!latestBlock) {
    throw new Error('failed to get latest block');
  }
  await contracts.protocolTimeManager
    .connect(deployer)
    .setProtocolStart(latestBlock.timestamp + 100)
    .then(tx => tx.wait());

  console.log('funding nodes...');
  const nodes = [];
  for (let i = 0; i < nodesConfig.relayNodes.length; i++) {
    const node = await createNode(provider, nodesConfig.relayNodes[i]);

    // setup tokens
    await contracts.syloToken
      .connect(deployer)
      .transfer(node.signer.getAddress(), ethers.parseEther('1000000'))
      .then(tx => tx.wait());

    await utils.addSeekerStake(contracts, node.signer, deployer, i);

    nodes.push(node);
  }

  // process relay nodes
  console.log('setting up nodes...');
  await Promise.all(
    nodes.map(async (node, i) => {
      await utils.updateFuturepassRegistrar(contracts, node.signer);
      await utils.addStake(contracts, node.signer);
      await utils.registerNodes(contracts, node);

      await contracts.directory
        .connect(node.signer)
        .joinNextDirectory()
        .then(tx => tx.wait());

      console.log('Relay node', await node.signer.getAddress(), 'is ready');
    }),
  );

  // process incentivising nodes
  const incentivisingNodes = [];
  for (let i = 0; i < nodesConfig.incentivisingNodes.length; i++) {
    const node = await createNode(provider, nodesConfig.incentivisingNodes[i]);

    await contracts.syloToken
      .connect(deployer)
      .transfer(node.signer.getAddress(), ethers.parseEther('10000000'))
      .then(tx => tx.wait());

    await utils.updateFuturepassRegistrar(contracts, node.signer);
    await utils.registerNodes(contracts, node);
    await utils.depositTicketing(contracts, node.signer);

    if (
      nodesConfig.incentivisingNodes[i].authorizedAccount.address.length > 0
    ) {
      await utils.authorizeAccount(
        contracts,
        node.signer,
        nodesConfig.incentivisingNodes[i].authorizedAccount.address,
      );
    }

    incentivisingNodes.push(node);

    console.log('Incentivising node', i, 'is ready');
  }

  // forward time to start protocol
  await provider.send('evm_increaseTime', [101]);
  await provider.send('evm_mine', []);

  // ensure each node can redeem a ticket from incentivising
  for (const node of nodes) {
    const { ticket, redeemerRand, senderSig, receiverSig } =
      await utils.createSignedTicket(
        contracts,
        incentivisingNodes[0].signer,
        incentivisingNodes[0].signer,
        node.signer,
      );

    await contracts.ticketing
      .connect(node.signer)
      .redeem(ticket, redeemerRand, senderSig, receiverSig)
      .then(tx => tx.wait());
  }

  // have each node also have unclaimed rewards for the first cycle
  for (const node of nodes) {
    await utils.depositTicketing(contracts, node.signer);

    const { ticket, redeemerRand, senderSig, receiverSig } =
      await utils.createSignedTicket(
        contracts,
        node.signer,
        node.signer,
        node.signer,
      );

    await contracts.ticketing
      .connect(node.signer)
      .redeem(ticket, redeemerRand, senderSig, receiverSig)
      .then(tx => tx.wait());

    console.log(
      `node ${await node.signer.getAddress()} successfully redeemed!`,
    );
  }

  // progress to start next cycle
  await provider.send('evm_increaseTime', [1001]);
  await provider.send('evm_mine', []);
}

async function createNode(
  provider: ethers.JsonRpcProvider,
  nodeConfig: utils.NodeConfig,
): Promise<utils.Node> {
  const newNode = new ethers.Wallet(nodeConfig.privateKey, provider);

  return {
    signer: newNode,
    publicEndPoint: nodeConfig.publicEndpoint,
  };
}

export function connectSigner(
  wallet: ethers.Wallet,
  provider: ethers.Provider,
): ethers.Wallet {
  const s = wallet.connect(provider);

  const sendTx = s.sendTransaction.bind(s);

  s.sendTransaction = async t => {
    const tx = await sendTx(t);
    await tx.wait(1);
    return tx;
  };

  return s;
}

main();
