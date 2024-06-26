// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import "./IStakingOrchestrator.sol";

contract StakingOrchestrator is
    IStakingOrchestrator,
    Initializable,
    Ownable2StepUpgradeable,
    ERC165
{
    mapping(address => uint256) nodeStake;

    function getNodeCurrentStake(address node) external view returns (uint256) {
        return nodeStake[node];
    }

    function getUserCurrentStake(address node, address user) external returns (uint256) {
        return 0;
    }

    function getUserPeriodStake(
        address node,
        address user,
        uint256 cycle
    ) external returns (uint256) {
        return 0;
    }

    function syloStakeAdded(address node, address user, uint256 newAmount) external {
        nodeStake[node] += newAmount;
    }

    function syloStakeRemoved(address node, address user, uint256 newAmount) external {}

    function seekerStakeAdded(address node, address user, uint256 seekerId) external {}

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external {}
}
