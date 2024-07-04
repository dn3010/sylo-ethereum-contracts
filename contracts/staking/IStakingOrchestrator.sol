// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IStakingOrchestrator {
    function getNodeStake(uint256 cycle, address node) external returns (uint256);

    function getUserStake(uint256 cycle, address node, address user) external returns (uint256);

    function getCurrentNodeStake(address node) external returns (uint256);

    function getCurrentUserStake(address node, address user) external returns (uint256);

    function syloStakeAdded(address node, address user, uint256 amount) external;

    function syloStakeRemoved(address node, address user, uint256 amount) external;

    function seekerStakeAdded(address node, address user, uint256 seekerId) external;

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external;
}
