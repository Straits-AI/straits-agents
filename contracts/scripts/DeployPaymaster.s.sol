// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/UsdcPaymaster.sol";

contract DeployPaymasterScript is Script {
    // ERC-4337 EntryPoint v0.7 (deployed on all major chains)
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    // USDC on Arbitrum Sepolia
    address constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy UsdcPaymaster with 0.01 ETH initial deposit
        // Exchange rate: $3000/ETH = 3000e6 USDC per 1e18 wei
        UsdcPaymaster paymaster = new UsdcPaymaster{value: 0.01 ether}(
            IEntryPoint(ENTRYPOINT_V07),
            IERC20(USDC_ARBITRUM_SEPOLIA),
            3000e6,  // usdcPerEthNumerator ($3000 in 6-decimal USDC)
            1e18     // usdcPerEthDenominator (1 ETH in wei)
        );
        console.log("UsdcPaymaster deployed at:", address(paymaster));

        // Add stake to EntryPoint (required for paymaster reputation)
        // 1-day unstake delay, 0.01 ETH stake
        paymaster.addStake{value: 0.01 ether}(86400);
        console.log("Staked 0.01 ETH with 1-day unstake delay");

        vm.stopBroadcast();
    }
}
