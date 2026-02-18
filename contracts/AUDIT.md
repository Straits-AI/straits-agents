# Smart Contract Security Audit Report

**Project:** Straits Agents Marketplace
**Auditor:** Internal (AI-assisted with Claude Code)
**Date:** February 18, 2026
**Solidity Version:** 0.8.24
**Framework:** Foundry
**Dependencies:** OpenZeppelin Contracts v5.4.0

---

## 1. Executive Summary

This audit covers the three Solidity contracts that underpin the Straits Agents marketplace: identity registration, reputation tracking, and USDC gas sponsorship via ERC-4337. The contracts are deployed on Arbitrum Sepolia (chainId 421614) and BNB Smart Chain Testnet (chainId 97).

### Scope

| Contract | Lines | Purpose |
|----------|-------|---------|
| `IdentityRegistry.sol` | 147 | ERC-721 agent identity NFTs with activation state |
| `ReputationRegistry.sol` | 191 | On-chain reputation with simple and detailed feedback |
| `UsdcPaymaster.sol` | 189 | ERC-4337 paymaster accepting USDC for gas fees |

### Methodology

- Manual line-by-line code review
- Automated testing with Foundry (92 tests)
- Pattern analysis against known vulnerability classes (reentrancy, overflow, access control, oracle manipulation)

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | Fixed |
| Medium | 3 | Open |
| Low | 7 | Open |
| Informational | 5 | — |

---

## 2. Contract Overview

### IdentityRegistry.sol

**Purpose:** ERC-8004 compliant agent identity registry. Each AI agent is an ERC-721 NFT with associated wallet address, activation status, and metadata URI.

**Inheritance:** ERC721, ERC721URIStorage, Ownable (OpenZeppelin v5.4.0)

**Key Functions:**
- `registerAgent()` — Mints NFT, maps wallet to token
- `updateMetadata()` — Owner-only URI update
- `deactivateAgent()` / `reactivateAgent()` — Toggle activation
- `getAgent()` — View agent details

### ReputationRegistry.sol

**Purpose:** On-chain reputation tracking with two feedback modes: simple (overall rating) and detailed (4-category weighted averages).

**Inheritance:** Ownable (OpenZeppelin v5.4.0)

**Key Functions:**
- `submitFeedback()` — Simple 1-5 rating (cumulative score)
- `submitDetailedFeedback()` — 4-category weighted averages
- `getReputation()` / `getFeedback()` — View functions

### UsdcPaymaster.sol

**Purpose:** Custom ERC-4337 paymaster that sponsors gas in exchange for USDC. Users approve the paymaster, and it collects USDC fees in `postOp`.

**Inheritance:** IPaymaster, Ownable (OpenZeppelin v5.4.0)

**Key Functions:**
- `validatePaymasterUserOp()` — Validate sender has USDC, check allowlist/cap
- `postOp()` — Collect actual USDC fee after operation
- Owner admin: exchange rate, allowlist, deposit/withdraw

---

## 3. Findings

### Critical

#### C-01: IdentityRegistry — Token ID 0 Bypasses Duplicate Wallet Prevention [FIXED]

**Location:** `IdentityRegistry.sol:14`

**Description:** The `registerAgent()` function uses `walletToToken[agentWallet] == 0` to check if a wallet is already registered. Previously, `_nextTokenId` started at 0, so the first registered agent received token ID 0. This made `walletToToken` return `0` for both "not registered" and "registered as token 0", allowing the first agent's wallet to be re-registered.

**Fix Applied:** Changed `_nextTokenId` to start at 1:

```solidity
uint256 private _nextTokenId = 1; // Start at 1 so walletToToken==0 means "not registered"
```

**Verification:** See `test_registerAgent_firstWalletDuplicatePrevented()` in `IdentityRegistry.t.sol` — confirms the duplicate is now correctly rejected for all wallets including the first one.

---

### Medium

#### M-01: UsdcPaymaster — USDC `transferFrom` Failure in `postOp` Drains Paymaster ETH

**Location:** `UsdcPaymaster.sol:122-123`

**Description:** In `postOp()`, if the USDC `transferFrom` fails (e.g., sender revoked approval between validation and execution), the `require` causes a revert. Per ERC-4337 spec, a `postOp` revert causes the EntryPoint to call `postOp` again with `PostOpMode.postOpReverted`. In the current implementation, `postOpReverted` falls through to the no-charge branch, meaning the paymaster absorbs the entire ETH gas cost with no USDC recovery.

**Impact:** A malicious sender could systematically drain the paymaster's ETH deposit by submitting UserOps and revoking USDC approval before `postOp` executes.

**Recommendation:** In the `postOp` function, handle `PostOpMode.postOpReverted` explicitly. Consider using a `try/catch` pattern for the `transferFrom`, or deducting from a pre-deposited USDC escrow during validation rather than relying on post-execution transfers.

---

#### M-02: UsdcPaymaster — Manual Exchange Rate with No Oracle or Staleness Protection

**Location:** `UsdcPaymaster.sol:132-137`

**Description:** The ETH/USDC exchange rate is set manually by the owner via `setExchangeRate()`. There is no on-chain oracle integration, no staleness check, and no bounds validation on the rate values.

**Impact:** If the owner sets a stale or incorrect rate, users could be over- or under-charged. An owner key compromise could set the rate to extract maximum USDC from users.

**Recommendation:** For mainnet, integrate a Chainlink price feed or similar oracle. At minimum, add bounds validation (e.g., rate must be within 50-200% of the previous rate) and a staleness timestamp. Acceptable for testnet but critical to address before mainnet.

---

#### M-03: ReputationRegistry — Integer Division Precision Loss in Weighted Averages

**Location:** `ReputationRegistry.sol:121-125`

**Description:** The weighted average calculation uses integer division which truncates fractional results:

```solidity
rep.totalScore = ((rep.totalScore * count) + (rating * 20)) / (count + 1);
```

Over many reviews, cumulative truncation causes the stored score to drift from the true average. For example, scores of 5, 2, 1 yield a stored average of 53 instead of the true 53.33.

**Impact:** Low precision impact for small review counts. For agents with hundreds of reviews, the error could accumulate to 1-2 points on the 0-100 scale. This is acceptable for a reputation signal but not for financial calculations.

**Recommendation:** Use a larger scaling factor (e.g., multiply by 1e18 before division, display with decimals off-chain) to improve precision. Alternatively, store the raw sum and count, computing averages off-chain.

---

### Low

#### L-01: UsdcPaymaster — Hardcoded Minimum Fee Not Adjustable

**Location:** `UsdcPaymaster.sol:117-118`

**Description:** The minimum fee of 0.01 USDC (10000 in 6-decimal terms) is hardcoded. This cannot be adjusted if gas conditions change significantly or if the contract is deployed on a chain with different cost characteristics.

**Recommendation:** Make the minimum fee a configurable parameter with an owner setter function.

---

#### L-02: UsdcPaymaster — Allowlist Disabled by Default

**Location:** `UsdcPaymaster.sol:30`

**Description:** `allowlistEnabled` defaults to `false`, allowing any address to use the paymaster. This is intentional for testnet but must be enabled before mainnet deployment.

**Recommendation:** Enable the allowlist before mainnet. Consider defaulting to `true` in the constructor for production deployments.

---

#### L-03: IdentityRegistry — No Pause Mechanism

**Description:** There is no emergency pause functionality. If a vulnerability is discovered post-deployment, there is no way to freeze registrations or transfers.

**Recommendation:** Inherit OpenZeppelin's `Pausable` and add `whenNotPaused` modifiers to `registerAgent()`, `updateMetadata()`, and transfer functions.

---

#### L-04: IdentityRegistry — No Admin Revocation

**Description:** There is no mechanism for the contract owner to deactivate or revoke a compromised agent's identity. Only the NFT owner can deactivate their own agent.

**Recommendation:** Add an owner-controlled `forceDeactivate(uint256 tokenId)` function for emergency revocation of compromised or malicious agents.

---

#### L-05: ReputationRegistry — No Sybil Resistance

**Description:** Any Ethereum address can submit a review. There is no stake requirement, identity verification, or interaction proof. An attacker can create multiple addresses to inflate or deflate an agent's reputation.

**Recommendation:** Require that reviewers have completed a paid interaction (verified via payment hash), or implement a minimum token stake for reviews.

---

#### L-06: ReputationRegistry — Immutable Feedback

**Description:** Once submitted, feedback cannot be modified or deleted. There is no mechanism to remove spam or abusive reviews.

**Recommendation:** Add an owner-controlled `removeFeedback()` function that adjusts the aggregate scores. Include a dispute mechanism or require reviews to meet minimum criteria.

---

#### L-07: All Contracts — Using `require` Strings Instead of Custom Errors

**Description:** All three contracts use `require(condition, "string message")` instead of Solidity 0.8.4+ custom errors. Custom errors are more gas-efficient and provide structured error data.

**Example:**
```solidity
// Current:
require(agentWallet != address(0), "Invalid agent wallet");

// Recommended:
error InvalidAgentWallet();
if (agentWallet == address(0)) revert InvalidAgentWallet();
```

**Impact:** Higher gas costs on reverts. Estimated savings: 100-200 gas per revert with custom errors.

---

### Informational

#### I-01: OpenZeppelin v5.4.0 — Audited Dependencies

All three contracts inherit from OpenZeppelin Contracts v5.4.0, which is a well-audited and widely-used library. This provides strong foundational security for ERC-721, access control, and ERC-20 interfaces.

#### I-02: Solidity 0.8.24 — Built-in Overflow Protection

Solidity 0.8.x includes built-in overflow/underflow checks, eliminating an entire class of arithmetic vulnerabilities without requiring SafeMath.

#### I-03: Access Control Patterns

- IdentityRegistry: `Ownable` for contract admin, `ownerOf()` checks for NFT-specific operations
- ReputationRegistry: `Ownable` for contract admin
- UsdcPaymaster: `Ownable` for admin functions, `onlyEntryPoint` modifier for ERC-4337 callbacks

#### I-04: Events Emitted for All State Changes

All contracts emit events for important state transitions (registration, feedback, payments, config changes), enabling off-chain indexing and monitoring.

#### I-05: ReputationRegistry — Inconsistent Score Models Between Simple and Detailed Feedback

Simple feedback (`submitFeedback`) accumulates `totalScore` cumulatively (sum of `rating * 20`), while detailed feedback (`submitDetailedFeedback`) computes running weighted averages. If both are used for the same agent, `getReputation()` returns a hybrid score that may not accurately represent either model. The test `test_mixedFeedback_simpleThenDetailed` demonstrates this interaction.

---

## 4. Test Coverage

**92 tests across 3 test suites — all passing.**

```
Ran 3 test suites: 92 tests passed, 0 failed, 0 skipped
```

### IdentityRegistry.t.sol (29 tests)
- Registration: mint, identity, wallet mapping, events, increments, multiple callers
- Reverts: zero address, duplicate wallet (token > 0), duplicate across callers
- Bug proof: token ID 0 duplicate wallet bypass
- Metadata: update, non-owner revert
- Deactivate/Reactivate: success, non-owner revert, already-inactive/active revert
- getAgent: non-existent revert, correct data, deactivation reflected
- ERC-721: transfer updates ownership, previous owner loses control
- Interface: ERC-721, ERC-165, invalid interface ID
- Timestamp: registeredAt correctly set
- Name/Symbol: "Straits Agent" / "SAGENT"

### ReputationRegistry.t.sol (26 tests)
- Simple feedback: rating 1, rating 5, events, feedback ID increment
- Validation: rating 0 reverts, rating 6 reverts
- Duplicate prevention: same reviewer reverts, different agents allowed
- Score math: cumulative (2 reviews, 3 reviews)
- Detailed feedback: success, all category validation, duplicate prevention
- Weighted averages: 2 reviews exact, precision loss demonstrated
- Mixed feedback: simple then detailed interaction
- getFeedback: correct data, invalid index, out of bounds
- getFeedbackCount: zero, increments
- Boundary: rating 1 and 5
- hasReviewed: tracking

### UsdcPaymaster.t.sol (37 tests)
- Constructor: values, ETH deposit
- Validation: success, onlyEntryPoint
- Allowlist: disabled passes, enabled rejects unlisted, accepts listed, batch set, events
- Cost cap: rejects excessive, accepts within limit, events
- CallData: empty rejected, short rejected, 4-byte accepted
- Balance: insufficient USDC rejected
- postOp: USDC transfer, minimum fee, events, no charge on revert, onlyEntryPoint, transfer failure
- Exchange rate: set, zero denominator, onlyOwner, math verification, new rate
- Owner functions: all admin functions test onlyOwner reverts
- ETH: receive works

---

## 5. Recommendations for Mainnet

### Priority 1 — Must Fix

1. ~~**Fix token ID 0 bug (C-01)**~~ — **FIXED.** Token IDs now start at 1
2. **Handle `postOp` reverts (M-01)** — Prevent paymaster ETH drainage via USDC transfer failures

### Priority 2 — Should Fix

3. **Integrate price oracle (M-02)** — Replace manual exchange rate with Chainlink feed
4. **Enable allowlist (L-02)** — Toggle `allowlistEnabled = true` before mainnet
5. **Add pause mechanism (L-03)** — Emergency stop for IdentityRegistry

### Priority 3 — Nice to Have

6. **Improve score precision (M-03)** — Scale by 1e18 or store raw sums
7. **Add sybil resistance (L-05)** — Require interaction proof for reviews
8. **Custom errors (L-07)** — Gas optimization across all contracts
9. **Admin revocation (L-04)** — Force-deactivate compromised agents
10. **Configurable minimum fee (L-01)** — Owner-settable minimum USDC fee
11. **Feedback moderation (L-06)** — Admin removal of spam reviews

---

## 6. Deployed Contracts

### Arbitrum Sepolia (chainId 421614)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xfc4e8b1d87aae1F1577eeFF16d607E92afCde55D` |
| ReputationRegistry | `0x0C998b08FF0C9c7470272c9211935692B78Cb3AF` |
| UsdcPaymaster (v2) | `0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7` |

### BNB Smart Chain Testnet (chainId 97)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xef9CB6e223d4FC63E82e95b1A6CBFe0B31ef3DC4` |
| ReputationRegistry | `0xdd0cF51e1442274Ea0410897b7c0F2606a2c1669` |
| UsdcPaymaster | `0x9476C70Dd3e76f321028853c740F3dA2de27d355` |

---

*Report generated with AI-assisted analysis using Claude Code.*
