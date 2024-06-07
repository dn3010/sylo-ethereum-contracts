// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface ITicketing {
    function testerIncrementRewardPool(address node, uint256 cycle, uint256 amount) external;
}
