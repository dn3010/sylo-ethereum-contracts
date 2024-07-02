// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IRegistries {
    struct Registry {
        // Percentage of a tickets value that will be rewarded to
        // delegated stakers expressed as a fraction of 100000.
        // This value is currently locked to the default payout percentage
        // until epochs are implemented.
        uint32 payoutPercentage;
        // Public http/s endpoint to retrieve additional metadata
        // about the node.
        // The current metadata schema is as follows:
        //  { name: string, multiaddrs: string[] }
        string publicEndpoint;
    }

    function register(string calldata publicEndpoint) external;

    function setDefaultPayoutPercentage(uint32 _defaultPayoutPercentage) external;

    function getRegistry(address account) external view returns (Registry memory);

    function getNodes() external view returns (address[] memory);

    function getRegistries(
        uint256 start,
        uint256 end
    ) external view returns (address[] memory, Registry[] memory);

    function getTotalNodes() external view returns (uint256);
}
