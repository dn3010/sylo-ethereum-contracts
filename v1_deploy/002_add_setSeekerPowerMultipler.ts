import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();
  const deploy = hre.deployments.deploy.bind(hre.deployments);

  console.log('Upgrading Staking Manager, with deployer: ', deployer.address);

  const result = await deploy('StakingManager', {
    from: deployer.address,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
    },
  });

  console.log('Deployed updated Staking Manager. Result: ');
  console.log(result);
};

export default func;

func.tags = ['002'];
