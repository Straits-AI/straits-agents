// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/UsdcPaymaster.sol";

// Mock ERC-20 for USDC
contract MockUSDC is IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");
        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// Mock EntryPoint
contract MockEntryPoint is IEntryPoint {
    mapping(address => uint256) public deposits;

    function handleOps(PackedUserOperation[] calldata, address payable) external pure override {
        revert("Not implemented");
    }

    function handleAggregatedOps(UserOpsPerAggregator[] calldata, address payable) external pure override {
        revert("Not implemented");
    }

    function getNonce(address, uint192) external pure override returns (uint256) {
        return 0;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return deposits[account];
    }

    function depositTo(address account) external payable override {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external override {
        deposits[msg.sender] -= withdrawAmount;
        (bool success, ) = withdrawAddress.call{value: withdrawAmount}("");
        require(success, "Transfer failed");
    }

    function addStake(uint32) external payable override {}

    function unlockStake() external override {}

    function withdrawStake(address payable to) external override {
        (bool success, ) = to.call{value: 0}("");
        require(success, "Transfer failed");
    }

    receive() external payable {}
}

contract UsdcPaymasterTest is Test {
    UsdcPaymaster public paymaster;
    MockUSDC public usdc;
    MockEntryPoint public entryPoint;
    address public owner;
    address public sender;
    address public nonOwner;

    // Exchange rate: $3000/ETH = 3000e6 / 1e18
    uint256 constant RATE_NUM = 3000e6;
    uint256 constant RATE_DEN = 1e18;

    // A small maxCost that stays within default 1 USDC cap:
    // 0.0003 ETH * 3000 * 1.1 = 0.99 USDC (just under 1e6)
    uint256 constant SMALL_MAX_COST = 0.0003 ether;

    event ExchangeRateUpdated(uint256 numerator, uint256 denominator);
    event GasFeePaid(address indexed sender, uint256 usdcAmount);
    event SenderAllowlisted(address indexed sender, bool allowed);
    event MaxUsdcPerOpUpdated(uint256 newMax);
    event AllowlistToggled(bool enabled);

    function setUp() public {
        owner = address(this);
        sender = makeAddr("sender");
        nonOwner = makeAddr("nonOwner");

        entryPoint = new MockEntryPoint();
        usdc = new MockUSDC();
        paymaster = new UsdcPaymaster{value: 1 ether}(
            IEntryPoint(address(entryPoint)),
            IERC20(address(usdc)),
            RATE_NUM,
            RATE_DEN
        );

        // Give sender USDC and approve paymaster
        usdc.mint(sender, 100e6); // 100 USDC
        vm.prank(sender);
        usdc.approve(address(paymaster), type(uint256).max);
    }

    // ============ Constructor ============

    function test_constructor_setsValues() public view {
        assertEq(address(paymaster.entryPoint()), address(entryPoint));
        assertEq(address(paymaster.usdc()), address(usdc));
        assertEq(paymaster.usdcPerEthNumerator(), RATE_NUM);
        assertEq(paymaster.usdcPerEthDenominator(), RATE_DEN);
        assertEq(paymaster.owner(), owner);
    }

    function test_constructor_depositsToEntryPoint() public view {
        assertEq(entryPoint.deposits(address(paymaster)), 1 ether);
    }

    // ============ validatePaymasterUserOp ============

    function test_validatePaymasterUserOp_success() public {
        PackedUserOperation memory userOp = _buildUserOp(sender);

        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);

        assertEq(validationData, 0);
        (address decodedSender, uint256 maxUsdcCost) = abi.decode(context, (address, uint256));
        assertEq(decodedSender, sender);
        // maxUsdcCost = (0.0003e18 * 3000e6 * 110) / (1e18 * 100)
        // = 0.0003 * 3000 * 1.1 * 1e6 = 990_000 (0.99 USDC)
        assertEq(maxUsdcCost, 990_000);
    }

    function test_validatePaymasterUserOp_onlyEntryPoint() public {
        PackedUserOperation memory userOp = _buildUserOp(sender);

        vm.prank(nonOwner);
        vm.expectRevert("UsdcPaymaster: not EntryPoint");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
    }

    // ============ Allowlist ============

    function test_allowlist_disabled_anyoneCanUse() public {
        assertFalse(paymaster.allowlistEnabled());

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
        assertTrue(context.length > 0);
    }

    function test_allowlist_enabled_rejectedIfNotListed() public {
        paymaster.setAllowlistEnabled(true);

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        vm.expectRevert("UsdcPaymaster: sender not allowlisted");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
    }

    function test_allowlist_enabled_acceptedIfListed() public {
        paymaster.setAllowlistEnabled(true);
        paymaster.setAllowlistedSender(sender, true);

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
        assertTrue(context.length > 0);
    }

    function test_allowlist_batchSet() public {
        address[] memory senders = new address[](2);
        senders[0] = makeAddr("s1");
        senders[1] = makeAddr("s2");

        paymaster.setAllowlistedSenderBatch(senders, true);
        assertTrue(paymaster.allowlistedSenders(senders[0]));
        assertTrue(paymaster.allowlistedSenders(senders[1]));

        paymaster.setAllowlistedSenderBatch(senders, false);
        assertFalse(paymaster.allowlistedSenders(senders[0]));
        assertFalse(paymaster.allowlistedSenders(senders[1]));
    }

    function test_allowlist_emitsEvents() public {
        vm.expectEmit(true, false, false, true);
        emit AllowlistToggled(true);
        paymaster.setAllowlistEnabled(true);

        vm.expectEmit(true, false, false, true);
        emit SenderAllowlisted(sender, true);
        paymaster.setAllowlistedSender(sender, true);
    }

    // ============ Cost Cap ============

    function test_costCap_rejectsExcessiveCost() public {
        // Default max is 1e6 (1 USDC)
        // 0.01 ETH * 3000 * 1.1 = 33 USDC — way over 1 USDC cap
        uint256 bigMaxCost = 0.01 ether;

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        vm.expectRevert("UsdcPaymaster: exceeds max cost per op");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), bigMaxCost);
    }

    function test_costCap_acceptsWithinLimit() public {
        // Increase max to 50 USDC
        paymaster.setMaxUsdcPerOp(50e6);

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), 0.01 ether);
        assertTrue(context.length > 0);
    }

    function test_costCap_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit MaxUsdcPerOpUpdated(5e6);
        paymaster.setMaxUsdcPerOp(5e6);
    }

    // ============ CallData Validation ============

    function test_emptyCallData_rejected() public {
        PackedUserOperation memory userOp = _buildUserOp(sender);
        userOp.callData = ""; // Empty callData

        vm.prank(address(entryPoint));
        vm.expectRevert("UsdcPaymaster: empty callData");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
    }

    function test_shortCallData_rejected() public {
        PackedUserOperation memory userOp = _buildUserOp(sender);
        userOp.callData = hex"aabbcc"; // Only 3 bytes, < 4

        vm.prank(address(entryPoint));
        vm.expectRevert("UsdcPaymaster: empty callData");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
    }

    function test_fourByteCallData_accepted() public {
        PackedUserOperation memory userOp = _buildUserOp(sender);
        userOp.callData = hex"aabbccdd"; // Exactly 4 bytes

        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), SMALL_MAX_COST);
        assertTrue(context.length > 0);
    }

    // ============ USDC Balance Check ============

    function test_insufficientUSDC_rejected() public {
        paymaster.setMaxUsdcPerOp(200e6); // Raise cap

        // 0.04 ETH * 3000 * 1.1 = 132 USDC — sender only has 100
        uint256 bigMaxCost = 0.04 ether;

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        vm.expectRevert("UsdcPaymaster: insufficient USDC balance");
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), bigMaxCost);
    }

    // ============ postOp ============

    function test_postOp_transfersUSDC_onSuccess() public {
        uint256 actualGasCost = 0.0001 ether;
        bytes memory context = abi.encode(sender, uint256(1e6));

        uint256 senderBalBefore = usdc.balanceOf(sender);

        vm.prank(address(entryPoint));
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, actualGasCost, 0);

        uint256 senderBalAfter = usdc.balanceOf(sender);
        // actualUsdcCost = (0.0001e18 * 3000e6 * 110) / (1e18 * 100) = 330_000 (0.33 USDC)
        assertEq(senderBalBefore - senderBalAfter, 330_000);
    }

    function test_postOp_minimumFee() public {
        // Very small gas cost that would result in < 0.01 USDC
        uint256 tinyGasCost = 1; // 1 wei

        bytes memory context = abi.encode(sender, uint256(1e6));

        uint256 senderBalBefore = usdc.balanceOf(sender);

        vm.prank(address(entryPoint));
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, tinyGasCost, 0);

        uint256 senderBalAfter = usdc.balanceOf(sender);
        // Minimum fee is 10000 (0.01 USDC)
        assertEq(senderBalBefore - senderBalAfter, 10_000);
    }

    function test_postOp_emitsEvent() public {
        uint256 actualGasCost = 0.0001 ether;
        bytes memory context = abi.encode(sender, uint256(1e6));

        vm.prank(address(entryPoint));
        vm.expectEmit(true, false, false, true);
        emit GasFeePaid(sender, 330_000);
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, actualGasCost, 0);
    }

    function test_postOp_noChargeOnRevert() public {
        bytes memory context = abi.encode(sender, uint256(1e6));

        uint256 senderBalBefore = usdc.balanceOf(sender);

        vm.prank(address(entryPoint));
        paymaster.postOp(IPaymaster.PostOpMode.opReverted, context, 0.001 ether, 0);

        assertEq(usdc.balanceOf(sender), senderBalBefore); // No charge
    }

    function test_postOp_onlyEntryPoint() public {
        bytes memory context = abi.encode(sender, uint256(1e6));

        vm.prank(nonOwner);
        vm.expectRevert("UsdcPaymaster: not EntryPoint");
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, 0.001 ether, 0);
    }

    function test_postOp_transferFailure_reverts() public {
        address brokeSender = makeAddr("brokeSender");
        bytes memory context = abi.encode(brokeSender, uint256(1e6));

        vm.prank(address(entryPoint));
        vm.expectRevert("Insufficient balance");
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, 0.0001 ether, 0);
    }

    // ============ Exchange Rate ============

    function test_setExchangeRate_success() public {
        vm.expectEmit(false, false, false, true);
        emit ExchangeRateUpdated(5000e6, 1e18);
        paymaster.setExchangeRate(5000e6, 1e18);

        assertEq(paymaster.usdcPerEthNumerator(), 5000e6);
        assertEq(paymaster.usdcPerEthDenominator(), 1e18);
    }

    function test_setExchangeRate_revertsZeroDenominator() public {
        vm.expectRevert("UsdcPaymaster: zero denominator");
        paymaster.setExchangeRate(3000e6, 0);
    }

    function test_setExchangeRate_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.setExchangeRate(5000e6, 1e18);
    }

    // ============ Owner Functions ============

    function test_setMaxUsdcPerOp_revertsZero() public {
        vm.expectRevert("UsdcPaymaster: zero max");
        paymaster.setMaxUsdcPerOp(0);
    }

    function test_setAllowlistedSender_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.setAllowlistedSender(sender, true);
    }

    function test_setAllowlistEnabled_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.setAllowlistEnabled(true);
    }

    function test_setMaxUsdcPerOp_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.setMaxUsdcPerOp(5e6);
    }

    function test_depositToEntryPoint_onlyOwner() public {
        vm.deal(nonOwner, 1 ether);
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.depositToEntryPoint{value: 0.1 ether}();
    }

    function test_depositToEntryPoint_success() public {
        uint256 depositBefore = entryPoint.deposits(address(paymaster));
        paymaster.depositToEntryPoint{value: 0.5 ether}();
        assertEq(entryPoint.deposits(address(paymaster)), depositBefore + 0.5 ether);
    }

    function test_withdrawFromEntryPoint_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.withdrawFromEntryPoint(payable(nonOwner), 0.1 ether);
    }

    function test_withdrawUsdc_success() public {
        usdc.mint(address(paymaster), 50e6);

        address recipient = makeAddr("recipient");
        paymaster.withdrawUsdc(recipient, 50e6);
        assertEq(usdc.balanceOf(recipient), 50e6);
    }

    function test_withdrawUsdc_onlyOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        paymaster.withdrawUsdc(nonOwner, 1e6);
    }

    // ============ Exchange Rate Math ============

    function test_exchangeRate_calculation() public {
        // Raise cap to test larger values
        paymaster.setMaxUsdcPerOp(10e6);

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), 0.001 ether);

        (, uint256 maxUsdcCost) = abi.decode(context, (address, uint256));
        // 0.001 * 3000 * 1.1 = 3.3 USDC = 3_300_000
        assertEq(maxUsdcCost, 3_300_000);
    }

    function test_exchangeRate_withNewRate() public {
        // Change to $5000/ETH and raise cap
        paymaster.setExchangeRate(5000e6, 1e18);
        paymaster.setMaxUsdcPerOp(10e6);

        usdc.mint(sender, 100e6);

        PackedUserOperation memory userOp = _buildUserOp(sender);
        vm.prank(address(entryPoint));
        (bytes memory context, ) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), 0.001 ether);

        (, uint256 maxUsdcCost) = abi.decode(context, (address, uint256));
        // 0.001 * 5000 * 1.1 = 5.5 USDC = 5_500_000
        assertEq(maxUsdcCost, 5_500_000);
    }

    // ============ Receive ETH ============

    function test_receiveETH() public {
        (bool success, ) = address(paymaster).call{value: 1 ether}("");
        assertTrue(success);
    }

    // ============ Helpers ============

    function _buildUserOp(address _sender) internal pure returns (PackedUserOperation memory) {
        return PackedUserOperation({
            sender: _sender,
            nonce: 0,
            initCode: "",
            callData: abi.encodeWithSignature("execute(address,uint256,bytes)", address(0), 0, ""),
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: "",
            signature: ""
        });
    }
}
