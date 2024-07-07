// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IStakingOrchestrator {
    function getNodeCurrentStake(address node) external returns (uint256);

    function syloStakeAdded(address node, address user, uint256 newAmount) external;
}
