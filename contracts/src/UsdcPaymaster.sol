// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";

/**
 * @title UsdcPaymaster
 * @notice Custom ERC-4337 paymaster that accepts USDC for gas payment.
 *         Users approve the paymaster for USDC, and the paymaster collects
 *         the fee in postOp after the UserOp execution.
 */
contract UsdcPaymaster is IPaymaster, Ownable {
    IEntryPoint public immutable entryPoint;
    IERC20 public immutable usdc;

    // Fixed exchange rate: usdcPerEthNumerator / usdcPerEthDenominator
    // e.g., 3000e6 / 1e18 = $3000/ETH in 6-decimal USDC terms
    uint256 public usdcPerEthNumerator;
    uint256 public usdcPerEthDenominator;

    // 10% markup for gas safety margin (110 / 100)
    uint256 public constant MARKUP_NUMERATOR = 110;
    uint256 public constant MARKUP_DENOMINATOR = 100;

    // Security: sender allowlist + per-op cost cap
    mapping(address => bool) public allowlistedSenders;
    uint256 public maxUsdcPerOp = 1e6; // 1 USDC max per UserOp (6 decimals)
    bool public allowlistEnabled = false; // Disabled by default for testnet flexibility

    event ExchangeRateUpdated(uint256 numerator, uint256 denominator);
    event GasFeePaid(address indexed sender, uint256 usdcAmount);
    event SenderAllowlisted(address indexed sender, bool allowed);
    event MaxUsdcPerOpUpdated(uint256 newMax);
    event AllowlistToggled(bool enabled);

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "UsdcPaymaster: not EntryPoint");
        _;
    }

    constructor(
        IEntryPoint _entryPoint,
        IERC20 _usdc,
        uint256 _usdcPerEthNumerator,
        uint256 _usdcPerEthDenominator
    ) Ownable(msg.sender) payable {
        entryPoint = _entryPoint;
        usdc = _usdc;
        usdcPerEthNumerator = _usdcPerEthNumerator;
        usdcPerEthDenominator = _usdcPerEthDenominator;

        // Deposit constructor ETH to EntryPoint for gas prefunding
        if (msg.value > 0) {
            IEntryPointStake(address(_entryPoint)).depositTo{value: msg.value}(address(this));
        }
    }

    /**
     * @notice Validates whether the paymaster is willing to pay for the UserOp.
     *         Checks that the sender has enough USDC balance for the max gas cost.
     * @param userOp The packed user operation
     * @param maxCost The maximum ETH cost the paymaster must prefund
     * @return context Encoded (sender, maxUsdcCost) for use in postOp
     * @return validationData 0 for success
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        address sender = userOp.sender;

        // Security: enforce sender allowlist when enabled
        if (allowlistEnabled) {
            require(allowlistedSenders[sender], "UsdcPaymaster: sender not allowlisted");
        }

        // Security: require non-empty callData (prevent empty no-op sponsored ops)
        require(userOp.callData.length >= 4, "UsdcPaymaster: empty callData");

        // Convert maxCost (ETH wei) to USDC (6 decimals) with markup
        uint256 maxUsdcCost = (maxCost * usdcPerEthNumerator * MARKUP_NUMERATOR)
            / (usdcPerEthDenominator * MARKUP_DENOMINATOR);

        // Security: enforce per-operation cost cap
        require(maxUsdcCost <= maxUsdcPerOp, "UsdcPaymaster: exceeds max cost per op");

        // Check sender has enough USDC (they must have approved us before postOp runs)
        require(usdc.balanceOf(sender) >= maxUsdcCost, "UsdcPaymaster: insufficient USDC balance");

        context = abi.encode(sender, maxUsdcCost);
        validationData = 0;
    }

    /**
     * @notice Called after UserOp execution to collect the actual USDC gas fee.
     * @param mode Whether the op succeeded or reverted
     * @param context Encoded (sender, maxUsdcCost) from validatePaymasterUserOp
     * @param actualGasCost The actual ETH gas cost
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256
    ) external onlyEntryPoint {
        (address sender, ) = abi.decode(context, (address, uint256));

        if (mode == PostOpMode.opSucceeded) {
            // Convert actual gas cost to USDC with markup
            uint256 actualUsdcCost = (actualGasCost * usdcPerEthNumerator * MARKUP_NUMERATOR)
                / (usdcPerEthDenominator * MARKUP_DENOMINATOR);

            // Minimum fee of 0.01 USDC to cover dust
            if (actualUsdcCost < 10000) {
                actualUsdcCost = 10000; // 0.01 USDC
            }

            // Collect USDC fee (approval was set by the UserOp's callData batch)
            bool success = usdc.transferFrom(sender, address(this), actualUsdcCost);
            require(success, "UsdcPaymaster: USDC transfer failed");

            emit GasFeePaid(sender, actualUsdcCost);
        }
        // If opReverted, we absorb the cost (testnet-acceptable behavior)
    }

    // --- Owner functions ---

    function setExchangeRate(uint256 _numerator, uint256 _denominator) external onlyOwner {
        require(_denominator > 0, "UsdcPaymaster: zero denominator");
        usdcPerEthNumerator = _numerator;
        usdcPerEthDenominator = _denominator;
        emit ExchangeRateUpdated(_numerator, _denominator);
    }

    function setAllowlistedSender(address sender, bool allowed) external onlyOwner {
        allowlistedSenders[sender] = allowed;
        emit SenderAllowlisted(sender, allowed);
    }

    function setAllowlistedSenderBatch(address[] calldata senders, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < senders.length; i++) {
            allowlistedSenders[senders[i]] = allowed;
            emit SenderAllowlisted(senders[i], allowed);
        }
    }

    function setMaxUsdcPerOp(uint256 _maxUsdcPerOp) external onlyOwner {
        require(_maxUsdcPerOp > 0, "UsdcPaymaster: zero max");
        maxUsdcPerOp = _maxUsdcPerOp;
        emit MaxUsdcPerOpUpdated(_maxUsdcPerOp);
    }

    function setAllowlistEnabled(bool enabled) external onlyOwner {
        allowlistEnabled = enabled;
        emit AllowlistToggled(enabled);
    }

    function depositToEntryPoint() external payable onlyOwner {
        IEntryPointStake(address(entryPoint)).depositTo{value: msg.value}(address(this));
    }

    function withdrawFromEntryPoint(address payable to, uint256 amount) external onlyOwner {
        IEntryPointStake(address(entryPoint)).withdrawTo(to, amount);
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        IEntryPointStake(address(entryPoint)).addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        IEntryPointStake(address(entryPoint)).unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        IEntryPointStake(address(entryPoint)).withdrawStake(to);
    }

    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        bool success = usdc.transfer(to, amount);
        require(success, "UsdcPaymaster: USDC withdraw failed");
    }

    // Allow receiving ETH for deposits
    receive() external payable {}
}
