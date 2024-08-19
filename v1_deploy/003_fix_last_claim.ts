import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const deploy = hre.deployments.deploy.bind(hre.deployments);

  console.log('Upgrading Rewards Manager, with deployer: ', deployer.address);

  const result = await deploy('RewardsManager', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log('Deployed updated Rewards Manager. Result: ');
  console.log(result);
};

export default func;

func.tags = ['003'];
