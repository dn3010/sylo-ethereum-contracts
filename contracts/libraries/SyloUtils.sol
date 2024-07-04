// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

error ContractNameCannotBeEmpty();
error InterfaceIdCannotBeZeroBytes();
error TargetContractCannotBeZeroAddress(string name);
error TargetNotSupportInterface(string name, bytes4 interfaceId);

library SyloUtils {
    /**
     * @dev The maximum possible SYLO that exists in the network.
     */
    uint256 public constant MAX_SYLO = 10_000_000_000 ether;

    /**
     * @dev Percentages are expressed as a ratio where 100000 is the denominator.
     * A large denominator allows for more precision, e.g representing 12.5%
     * can be done as 12500 / 100000
     */
    uint32 public constant PERCENTAGE_DENOMINATOR = 100000;

    /**
     * @dev Multiply a value by a given percentage. Converts the provided
     * uint128 value to uint256 to avoid any reverts on overflow.
     * @param value The value to multiply.
     * @param percentage The percentage, as a ratio of 100000.
     */
    function percOf(uint256 value, uint32 percentage) internal pure returns (uint256) {
        return (uint256(value) * percentage) / PERCENTAGE_DENOMINATOR;
    }
}
