// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

interface IFuturepassRegistrar {
    function futurepassOf(address owner) external view returns (address);

    function create(address owner) external returns (address);
}