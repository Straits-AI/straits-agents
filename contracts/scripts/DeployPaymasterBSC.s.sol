// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/UsdcPaymaster.sol";

contract DeployPaymasterBSCScript is Script {
    // ERC-4337 EntryPoint v0.7 (deployed on all major chains)
    address constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    // USDC on BSC Testnet
    address constant USDC_BSC_TESTNET = 0x64544969ed7EBf5f083679233325356EbE738930;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy UsdcPaymaster with 0.01 BNB initial deposit
        // Exchange rate: $600/BNB = 600e6 USDC per 1e18 wei
        UsdcPaymaster paymaster = new UsdcPaymaster{value: 0.01 ether}(
            IEntryPoint(ENTRYPOINT_V07),
            IERC20(USDC_BSC_TESTNET),
            600e6,   // usdcPerEthNumerator ($600 in 6-decimal USDC)
            1e18     // usdcPerEthDenominator (1 BNB in wei)
        );
        console.log("UsdcPaymaster (BSC) deployed at:", address(paymaster));

        // Add stake to EntryPoint (required for paymaster reputation)
        // 1-day unstake delay, 0.01 BNB stake
        paymaster.addStake{value: 0.01 ether}(86400);
        console.log("Staked 0.01 BNB with 1-day unstake delay");

        vm.stopBroadcast();
    }
}
