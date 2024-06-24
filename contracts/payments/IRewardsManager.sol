// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IRewardsManager {
    function incrementRewardPool(address node, uint256 cycle, uint256 amount) external;

    function getRewardPool(address node, uint256 cycle) external view returns (uint256);

    function getUnclaimedNodeCommission(address node) external view returns (uint256);

    function claim(address node, uint256 cycle) external;
}
