// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IRewardsManager {
    function getRewardPool(address node, uint256 cycle) external view returns (uint256);

    function getRewardPools(
        address node,
        uint256[] calldata cycles
    ) external view returns (uint256[] memory);

    function getClaim(address node, address user, uint256 cycle) external view returns (uint256);

    function getUnclaimedReward(
        address node,
        address user,
        uint256 cycle
    ) external view returns (uint256);

    function getUnclaimedRewards(
        address node,
        address user,
        uint256[] calldata cycles
    ) external view returns (uint256[] memory);

    function getUnclaimedNodeCommission(address node) external view returns (uint256);

    function incrementRewardPool(address node, uint256 amount) external;

    function claim(address node, uint256 cycle) external;
}
