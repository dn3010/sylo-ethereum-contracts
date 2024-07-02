// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "./IRegistries.sol";

/**
 * @notice This contract manages Registries for Nodes. A Registry is a
 * set of parameters configured by the Node itself. A Node is required
 * to have a valid Registry to be able to participate in the network.
 */
contract Registries is IRegistries, Initializable, Ownable2StepUpgradeable, ERC165 {
    using ECDSA for bytes32;

    /**
     * @notice Tracks each Node's registry.
     */
    mapping(address => IRegistries.Registry) public registries;

    /**
     * @notice Tracks the address of every registered node.
     */
    address[] public nodes;

    /**
     * @notice Payout percentage refers to the portion of a tickets reward
     * that will be allocated to the Node's stakers. This is global, and is
     * currently set for all Nodes.
     */
    uint32 public defaultPayoutPercentage;

    event DefaultPayoutPercentageUpdated(uint32 defaultPayoutPercentage);

    error EndMustBeGreaterThanStart();
    error PercentageCannotExceed100000();
    error PublicEndpointCannotBeEmpty();
    error EndCannotExceedNumberOfNodes(uint256 nodeLength);

    function initialize(uint32 _defaultPayoutPercentage) external initializer {
        if (_defaultPayoutPercentage > 100000) {
            revert PercentageCannotExceed100000();
        }

        Ownable2StepUpgradeable.__Ownable2Step_init();

        defaultPayoutPercentage = _defaultPayoutPercentage;
    }

    /**
     * @notice Returns true if the contract implements the interface defined by
     * `interfaceId` from ERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IRegistries).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Set the global default payout percentage value. Only callable
     * by the owner.
     * @param _defaultPayoutPercentage The payout percentage as a value where the
     * denominator is 100000.
     */
    function setDefaultPayoutPercentage(uint32 _defaultPayoutPercentage) external onlyOwner {
        if (_defaultPayoutPercentage > 100000) {
            revert PercentageCannotExceed100000();
        }

        defaultPayoutPercentage = _defaultPayoutPercentage;
        emit DefaultPayoutPercentageUpdated(_defaultPayoutPercentage);
    }

    /**
     * @notice Call this as a Node to set or update your Registry entry.
     * @param publicEndpoint The public endpoint of your Node. Essential for
     * clients to be able to retrieve additional information, such as
     * an address to establish a p2p connection.
     */
    function register(string calldata publicEndpoint) external {
        if (bytes(publicEndpoint).length == 0) {
            revert PublicEndpointCannotBeEmpty();
        }

        // This is the nodes first registration
        if (bytes(registries[msg.sender].publicEndpoint).length == 0) {
            nodes.push(msg.sender);
        }

        registries[msg.sender].publicEndpoint = publicEndpoint;
    }

    /**
     * @notice Retrieve the registry associated with a Node.
     * @param account The address of the Node.
     * @return The Node's Registry.
     */
    function getRegistry(address account) external view returns (Registry memory) {
        return registries[account];
    }

    /**
     * @notice Retrieve all registered nodes.
     * @return An array of node addresses.
     */
    function getNodes() external view returns (address[] memory) {
        return nodes;
    }

    /**
     * @notice Retrieves a list of registries. Takes in a
     * a start and end indices to allow pagination.
     * @param start The start index which is inclusive.
     * @param end The end index which is exclusive.
     * @return An array of Registries.
     */
    function getRegistries(
        uint256 start,
        uint256 end
    ) external view returns (address[] memory, Registry[] memory) {
        uint256 nodesLength = nodes.length;

        if (end <= start) {
            revert EndMustBeGreaterThanStart();
        }
        if (end > nodesLength) {
            revert EndCannotExceedNumberOfNodes(nodesLength);
        }

        address[] memory _nodes = new address[](end - start);
        Registry[] memory _registries = new Registry[](_nodes.length);

        for (uint256 i = start; i < end; ++i) {
            _nodes[i - start] = nodes[i];
            _registries[i - start] = registries[nodes[i]];
        }

        return (_nodes, _registries);
    }

    /**
     * @notice Returns the total number of registered nodes.
     * @return The number of registered nodes.
     */
    function getTotalNodes() external view returns (uint256) {
        return nodes.length;
    }
}
