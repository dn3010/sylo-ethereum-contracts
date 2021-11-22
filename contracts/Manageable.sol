// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an list of public managers who may be added or removed.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyManager`, which can be applied to your functions to restrict their use to
 * other contracts which have explicitly been added.
 */
abstract contract Manageable is Initializable, OwnableUpgradeable {
    /**
     * @dev Certain functions of this contract should only be called by certain other
     * contracts.
     * We use this mapping to restrict access to those functions in a similar
     * fashion to the onlyOwner construct. The stored value is the block the
     * managing contract was added in.
     */
    mapping (address => uint256) public managers;

    /**
     * @notice Adds a manager to this contract. Only callable by the owner.
     * @param manager The address of the manager contract.
     */
    function addManager(address manager) public onlyOwner {
      managers[manager] = block.number;
    }

    /**
     * @notice Removes a manager from this contract. Only callable by the owner.
     * @param manager The address of the manager contract.
     */
    function removeManager(address manager) public onlyOwner {
      delete managers[manager];
    }

    /**
     * @dev This modifier allows us to specify that certain contracts have
     * special privileges to call restricted functions.
     */
    modifier onlyManager() {
      require(managers[msg.sender] > 0, "Only managers of this contract can call this function");
      _;
    }
}