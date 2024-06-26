// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IStakingOrchestrator {
    function getNodeCurrentStake(address node) external returns (uint256);

    function getUserCurrentStake(address node, address user) external returns (uint256);

    function getUserPeriodStake(
        address node,
        address user,
        uint256 cycle
    ) external returns (uint256);

    function syloStakeAdded(address node, address user, uint256 newAmount) external;

    function syloStakeRemoved(address node, address user, uint256 newAmount) external;

    function seekerStakeAdded(address node, address user, uint256 seekerId) external;

    function seekerStakeRemoved(address node, address user, uint256 seekerId) external;
}
