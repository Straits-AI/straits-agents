// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract IdentityRegistryTest is Test, IERC721Receiver {
    IdentityRegistry public registry;
    address public owner;
    address public alice;
    address public bob;
    address public agentWallet1;
    address public agentWallet2;

    event AgentRegistered(uint256 indexed tokenId, address indexed owner, address agentWallet);
    event AgentUpdated(uint256 indexed tokenId, string metadataUri);
    event AgentDeactivated(uint256 indexed tokenId);
    event AgentReactivated(uint256 indexed tokenId);

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        agentWallet1 = makeAddr("agentWallet1");
        agentWallet2 = makeAddr("agentWallet2");

        registry = new IdentityRegistry();
    }

    // ============ Registration ============

    function test_registerAgent_mintsNFT() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://metadata1");

        assertEq(tokenId, 1); // Token IDs start at 1
        assertEq(registry.ownerOf(tokenId), address(this));
        assertEq(registry.tokenURI(tokenId), "ipfs://metadata1");
    }

    function test_registerAgent_setsAgentIdentity() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://metadata1");

        (address agentOwner, address wallet, string memory uri, bool isActive) = registry.getAgent(tokenId);
        assertEq(agentOwner, address(this));
        assertEq(wallet, agentWallet1);
        assertEq(uri, "ipfs://metadata1");
        assertTrue(isActive);
    }

    function test_registerAgent_setsWalletToTokenMapping() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://metadata1");
        assertEq(registry.walletToToken(agentWallet1), tokenId);
    }

    function test_registerAgent_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit AgentRegistered(1, address(this), agentWallet1);
        registry.registerAgent(agentWallet1, "ipfs://metadata1");
    }

    function test_registerAgent_incrementsTokenId() public {
        uint256 id0 = registry.registerAgent(agentWallet1, "ipfs://meta1");
        uint256 id1 = registry.registerAgent(agentWallet2, "ipfs://meta2");

        assertEq(id0, 1); // Token IDs start at 1
        assertEq(id1, 2);
    }

    function test_registerAgent_multipleCallers() public {
        vm.prank(alice);
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        assertEq(registry.ownerOf(tokenId), alice);
    }

    // ============ Registration Reverts ============

    function test_registerAgent_revertsOnZeroAddress() public {
        vm.expectRevert("Invalid agent wallet");
        registry.registerAgent(address(0), "ipfs://meta1");
    }

    function test_registerAgent_revertsOnDuplicateWallet() public {
        registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.expectRevert("Agent wallet already registered");
        registry.registerAgent(agentWallet1, "ipfs://meta2");
    }

    function test_registerAgent_duplicateWallet_differentCallers() public {
        registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.prank(alice);
        vm.expectRevert("Agent wallet already registered");
        registry.registerAgent(agentWallet1, "ipfs://meta2");
    }

    function test_registerAgent_firstWalletDuplicatePrevented() public {
        // FIX VERIFIED: Token IDs start at 1, so walletToToken==0 reliably means "not registered"
        uint256 firstToken = registry.registerAgent(agentWallet1, "ipfs://meta1");
        assertEq(firstToken, 1); // First token is 1, not 0
        assertEq(registry.walletToToken(agentWallet1), 1); // Non-zero mapping

        // Now duplicate is correctly caught even for the first registered wallet
        vm.expectRevert("Agent wallet already registered");
        registry.registerAgent(agentWallet1, "ipfs://meta2");
    }

    // ============ Token ID 0 Edge Case ============

    function test_tokenIdZero_noAmbiguity() public {
        // With token IDs starting at 1, walletToToken==0 unambiguously means "not registered"
        address unregistered = makeAddr("unregistered");
        assertEq(registry.walletToToken(unregistered), 0); // Not registered

        registry.registerAgent(agentWallet1, "ipfs://meta1");
        assertEq(registry.walletToToken(agentWallet1), 1); // Token 1

        // Now they're different — no ambiguity
        assertTrue(registry.walletToToken(unregistered) != registry.walletToToken(agentWallet1));
    }

    // ============ Metadata Update ============

    function test_updateMetadata_success() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.expectEmit(true, false, false, true);
        emit AgentUpdated(tokenId, "ipfs://meta2");
        registry.updateMetadata(tokenId, "ipfs://meta2");

        assertEq(registry.tokenURI(tokenId), "ipfs://meta2");
    }

    function test_updateMetadata_revertsForNonOwner() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.prank(alice);
        vm.expectRevert("Not agent owner");
        registry.updateMetadata(tokenId, "ipfs://meta2");
    }

    // ============ Deactivate / Reactivate ============

    function test_deactivateAgent_success() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.expectEmit(true, false, false, false);
        emit AgentDeactivated(tokenId);
        registry.deactivateAgent(tokenId);

        assertFalse(registry.isAgentActive(tokenId));
    }

    function test_deactivateAgent_revertsForNonOwner() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.prank(alice);
        vm.expectRevert("Not agent owner");
        registry.deactivateAgent(tokenId);
    }

    function test_deactivateAgent_revertsIfAlreadyInactive() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        registry.deactivateAgent(tokenId);

        vm.expectRevert("Agent already inactive");
        registry.deactivateAgent(tokenId);
    }

    function test_reactivateAgent_success() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        registry.deactivateAgent(tokenId);

        vm.expectEmit(true, false, false, false);
        emit AgentReactivated(tokenId);
        registry.reactivateAgent(tokenId);

        assertTrue(registry.isAgentActive(tokenId));
    }

    function test_reactivateAgent_revertsForNonOwner() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        registry.deactivateAgent(tokenId);

        vm.prank(alice);
        vm.expectRevert("Not agent owner");
        registry.reactivateAgent(tokenId);
    }

    function test_reactivateAgent_revertsIfAlreadyActive() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        vm.expectRevert("Agent already active");
        registry.reactivateAgent(tokenId);
    }

    // ============ getAgent ============

    function test_getAgent_revertsForNonExistent() public {
        vm.expectRevert("Agent does not exist");
        registry.getAgent(999);
    }

    function test_getAgent_returnsCorrectData() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        (address agentOwner, address wallet, string memory uri, bool isActive) = registry.getAgent(tokenId);

        assertEq(agentOwner, address(this));
        assertEq(wallet, agentWallet1);
        assertEq(uri, "ipfs://meta1");
        assertTrue(isActive);
    }

    function test_getAgent_reflectsDeactivation() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        registry.deactivateAgent(tokenId);

        (, , , bool isActive) = registry.getAgent(tokenId);
        assertFalse(isActive);
    }

    // ============ ERC-721 Transfer ============

    function test_transfer_updatesOwnership() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        registry.transferFrom(address(this), alice, tokenId);
        assertEq(registry.ownerOf(tokenId), alice);

        // New owner can update metadata
        vm.prank(alice);
        registry.updateMetadata(tokenId, "ipfs://meta_new");
        assertEq(registry.tokenURI(tokenId), "ipfs://meta_new");
    }

    function test_transfer_previousOwnerLosesControl() public {
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");
        registry.transferFrom(address(this), alice, tokenId);

        vm.expectRevert("Not agent owner");
        registry.updateMetadata(tokenId, "ipfs://should_fail");
    }

    // ============ supportsInterface ============

    function test_supportsInterface_ERC721() public view {
        // ERC-721 interface ID: 0x80ac58cd
        assertTrue(registry.supportsInterface(0x80ac58cd));
    }

    function test_supportsInterface_ERC165() public view {
        // ERC-165 interface ID: 0x01ffc9a7
        assertTrue(registry.supportsInterface(0x01ffc9a7));
    }

    function test_supportsInterface_invalidId() public view {
        assertFalse(registry.supportsInterface(0xffffffff));
    }

    // ============ registeredAt Timestamp ============

    function test_registeredAt_isSet() public {
        vm.warp(1000);
        uint256 tokenId = registry.registerAgent(agentWallet1, "ipfs://meta1");

        (, , uint256 registeredAt) = registry.agents(tokenId);
        assertEq(registeredAt, 1000);
    }

    // ============ Name and Symbol ============

    function test_nameAndSymbol() public view {
        assertEq(registry.name(), "Straits Agent");
        assertEq(registry.symbol(), "SAGENT");
    }
}
