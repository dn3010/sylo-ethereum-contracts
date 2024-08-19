import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const deploy = hre.deployments.deploy.bind(hre.deployments);

  console.log('Upgrading Sylo Ticketing, with deployer: ', deployer.address);

  const result = await deploy('SyloTicketing', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log('Deployed updated Sylo Ticketing. Result: ');
  console.log(result.receipt);
};

export default func;

func.tags = ['005'];
