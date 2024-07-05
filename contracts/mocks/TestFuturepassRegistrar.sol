// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

contract TestFuturepassRegistrar {
    mapping(address => address) registrations;

    function futurepassOf(address owner) external view returns (address) {
        return registrations[owner];
    }

    function create(address owner) external returns (address) {
        // ticketing contract does not actually care about futurepass
        // address value, just needs to be non-zero
        registrations[owner] = owner;
        return owner;
    }
}
