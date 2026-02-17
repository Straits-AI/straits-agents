// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/IdentityRegistry.sol";
import "../src/ReputationRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy IdentityRegistry
        IdentityRegistry identityRegistry = new IdentityRegistry();
        console.log("IdentityRegistry deployed at:", address(identityRegistry));

        // Deploy ReputationRegistry
        ReputationRegistry reputationRegistry = new ReputationRegistry();
        console.log("ReputationRegistry deployed at:", address(reputationRegistry));

        vm.stopBroadcast();
    }
}
