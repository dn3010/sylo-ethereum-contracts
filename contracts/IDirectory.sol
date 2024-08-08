// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IDirectory {
    /**
     * @dev A DirectoryEntry will be stored for every node that joins the
     * network in a specific period. The entry will contain the stakee's
     * address, and a boundary value which is a sum of the current directory's
     * total stake, and the current stakee's total stake.
     */
    struct DirectoryEntry {
        address stakee;
        uint256 boundary;
    }

    /**
     * @dev A Directory will be stored for every period. The
     * directory will be constructed piece by piece as Nodes join,
     * each adding their own directory entry based on their current
     * stake value.
     */
    struct Directory {
        DirectoryEntry[] entries;
        mapping(address => uint256) stakes;
        uint256 totalStake;
    }

    function scan(uint128 point) external returns (address);

    function scanWithTime(
        uint128 point,
        uint256 cycleId,
        uint256 periodId
    ) external returns (address);

    function joinNextDirectory() external;

    function getDirectoryStake(uint256 cycleId, uint256 periodId, address node) external view returns (uint256);

    function getEntries(uint256 cycleId, uint256 periodId) external view returns (address [] memory, uint256[] memory);
}
