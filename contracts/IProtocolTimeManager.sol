// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IProtocolTimeManager {
    struct Cycle {
        uint256 id;
        uint256 start;
        uint256 duration;
    }

    struct Period {
        uint256 id;
        uint256 start;
        uint256 duration;
    }

    function setProtocolStart(uint256 _start) external;

    function setCycleDuration(uint256 duration) external;

    function setPeriodDuration(uint256 duration) external;

    function getCycleDuration() external returns (uint256);

    function getPeriodDuration() external returns (uint256);

    function getTime() external view returns (Cycle memory, Period memory);

    function getCurrentCycle() external view returns (Cycle memory);

    function getCurrentPeriod() external view returns (Period memory);

    function getStart() external view returns (uint256);
}
