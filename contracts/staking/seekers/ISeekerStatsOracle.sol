// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface ISeekerStatsOracle {
    struct Seeker {
        uint256 seekerId;
        uint256 rank;
        uint256 attrReactor;
        uint256 attrCores;
        uint256 attrDurability;
        uint256 attrSensors;
        uint256 attrStorage;
        uint256 attrChip;
    }

    function setOracle(address _oracle) external;

    function createProofMessage(Seeker calldata seeker) external pure returns (bytes memory);

    function registerSeekerRestricted(Seeker calldata seeker) external;

    function registerSeeker(Seeker calldata seeker, bytes calldata proof) external;

    function calculateAttributeCoverage(Seeker[] calldata seekers) external view returns (int256);

    function isSeekerRegistered(Seeker calldata seeker) external view returns (bool);

    function getSeekerStats(uint256 seekerId) external view returns (Seeker memory);
}
