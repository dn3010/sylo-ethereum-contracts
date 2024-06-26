// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IProtocolTimeManager {
    struct Cycle {
        uint256 iteration;
        uint256 start;
        uint256 duration;
    }

    function setProtocolStart(uint256 _start) external;

    function setCycleDuration(uint256 duration) external;

    function setPeriodDuration(uint256 duration) external;

    function getCycleDuration() external returns (uint256);

    function getPeriodDuration() external returns (uint256);

    function getTime() external returns (uint256, uint256, Cycle memory);

    function getCurrentCycle() external returns (Cycle memory);

    function getCurrentPeriod() external returns (uint256);

    function getStart() external view returns (uint256);

    function isFinalStakingPeriod() external view returns (bool);
}
