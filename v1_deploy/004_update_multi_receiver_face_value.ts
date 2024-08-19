import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const deploy = hre.deployments.deploy.bind(hre.deployments);

  console.log(
    'Upgrading Ticketing, Ticketing Parameters and Epochs Manager contracts, with deployer: ',
    deployer.address,
  );

  const ticketingParametersResult = await deploy('TicketingParameters', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log(
    'Deployed updated TicketingParameters. Receipt: ',
    ticketingParametersResult.receipt,
  );

  const syloTicketingResult = await deploy('SyloTicketing', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log(
    'Deployed updated SyloTicketing. Result: ',
    syloTicketingResult.receipt,
  );

  const epochsManagerResult = await deploy('EpochsManager', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log(
    'Deployed updated EpochsManager. Result: ',
    epochsManagerResult.receipt,
  );
};

export default func;

func.tags = ['004'];
