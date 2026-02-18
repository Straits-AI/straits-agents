// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry public registry;
    address public alice;
    address public bob;
    address public charlie;

    uint256 constant AGENT_ID = 0;

    event FeedbackSubmitted(
        uint256 indexed feedbackId,
        uint256 indexed agentTokenId,
        address indexed reviewer,
        uint8 rating
    );

    function setUp() public {
        registry = new ReputationRegistry();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
    }

    // ============ Simple Feedback ============

    function test_submitFeedback_rating1() public {
        vm.prank(alice);
        uint256 feedbackId = registry.submitFeedback(AGENT_ID, 1, keccak256("bad"));
        assertEq(feedbackId, 0);

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 1);
        // Simple feedback: totalScore = 1*20 = 20 (cumulative, not averaged)
        assertEq(overallScore, 20);
    }

    function test_submitFeedback_rating5() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 5, keccak256("excellent"));

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 1);
        assertEq(overallScore, 100); // 5*20 = 100
    }

    function test_submitFeedback_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit FeedbackSubmitted(0, AGENT_ID, alice, 3);
        registry.submitFeedback(AGENT_ID, 3, keccak256("ok"));
    }

    function test_submitFeedback_incrementsFeedbackId() public {
        vm.prank(alice);
        uint256 id0 = registry.submitFeedback(AGENT_ID, 3, keccak256("ok"));

        vm.prank(bob);
        uint256 id1 = registry.submitFeedback(AGENT_ID, 4, keccak256("good"));

        assertEq(id0, 0);
        assertEq(id1, 1);
    }

    // ============ Rating Validation ============

    function test_submitFeedback_revertsOnRating0() public {
        vm.prank(alice);
        vm.expectRevert("Rating must be 1-5");
        registry.submitFeedback(AGENT_ID, 0, keccak256("zero"));
    }

    function test_submitFeedback_revertsOnRating6() public {
        vm.prank(alice);
        vm.expectRevert("Rating must be 1-5");
        registry.submitFeedback(AGENT_ID, 6, keccak256("six"));
    }

    // ============ Duplicate Prevention ============

    function test_submitFeedback_revertsDuplicate() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 5, keccak256("great"));

        vm.prank(alice);
        vm.expectRevert("Already reviewed");
        registry.submitFeedback(AGENT_ID, 4, keccak256("changed mind"));
    }

    function test_submitFeedback_differentAgents_sameReviewer() public {
        vm.prank(alice);
        registry.submitFeedback(0, 5, keccak256("great"));

        vm.prank(alice);
        registry.submitFeedback(1, 3, keccak256("ok")); // Different agent — allowed
    }

    // ============ Simple Feedback Score Math ============

    function test_simpleFeedback_cumulativeScore_twoReviews() public {
        // Simple feedback uses cumulative totalScore (NOT averaged)
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 5, keccak256("great")); // +100

        vm.prank(bob);
        registry.submitFeedback(AGENT_ID, 3, keccak256("ok")); // +60

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 2);
        // Simple feedback: totalScore = 100 + 60 = 160 (cumulative)
        assertEq(overallScore, 160);
    }

    function test_simpleFeedback_cumulativeScore_threeReviews() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 1, keccak256("1")); // +20

        vm.prank(bob);
        registry.submitFeedback(AGENT_ID, 5, keccak256("5")); // +100

        vm.prank(charlie);
        registry.submitFeedback(AGENT_ID, 3, keccak256("3")); // +60

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 3);
        assertEq(overallScore, 180); // 20 + 100 + 60
    }

    // ============ Detailed Feedback ============

    function test_submitDetailedFeedback_success() public {
        vm.prank(alice);
        uint256 feedbackId = registry.submitDetailedFeedback(AGENT_ID, 5, 4, 3, 5, 4, keccak256("detailed"));
        assertEq(feedbackId, 0);

        (uint256 overallScore, uint256 totalReviews, uint256 accuracy, uint256 helpfulness, uint256 speed, uint256 safety) =
            registry.getReputation(AGENT_ID);

        assertEq(totalReviews, 1);
        assertEq(overallScore, 100); // 5*20 = 100
        assertEq(accuracy, 80);     // 4*20
        assertEq(helpfulness, 60);  // 3*20
        assertEq(speed, 100);       // 5*20
        assertEq(safety, 80);       // 4*20
    }

    function test_submitDetailedFeedback_validation() public {
        vm.prank(alice);
        vm.expectRevert("Accuracy must be 1-5");
        registry.submitDetailedFeedback(AGENT_ID, 3, 0, 3, 3, 3, keccak256("bad"));

        vm.prank(alice);
        vm.expectRevert("Helpfulness must be 1-5");
        registry.submitDetailedFeedback(AGENT_ID, 3, 3, 6, 3, 3, keccak256("bad"));

        vm.prank(alice);
        vm.expectRevert("Speed must be 1-5");
        registry.submitDetailedFeedback(AGENT_ID, 3, 3, 3, 0, 3, keccak256("bad"));

        vm.prank(alice);
        vm.expectRevert("Safety must be 1-5");
        registry.submitDetailedFeedback(AGENT_ID, 3, 3, 3, 3, 6, keccak256("bad"));
    }

    function test_submitDetailedFeedback_revertsDuplicate() public {
        vm.prank(alice);
        registry.submitDetailedFeedback(AGENT_ID, 5, 5, 5, 5, 5, keccak256("first"));

        vm.prank(alice);
        vm.expectRevert("Already reviewed");
        registry.submitDetailedFeedback(AGENT_ID, 3, 3, 3, 3, 3, keccak256("second"));
    }

    // ============ Detailed Feedback Weighted Average ============

    function test_detailedFeedback_weightedAverage_twoReviews() public {
        // First review: rating=5, accuracy=5 (scores: 100, 100)
        vm.prank(alice);
        registry.submitDetailedFeedback(AGENT_ID, 5, 5, 5, 5, 5, keccak256("1"));

        // Second review: rating=1, accuracy=1 (scores: 20, 20)
        // Weighted avg: (100*1 + 20) / 2 = 60
        vm.prank(bob);
        registry.submitDetailedFeedback(AGENT_ID, 1, 1, 1, 1, 1, keccak256("2"));

        (uint256 overallScore, uint256 totalReviews, uint256 accuracy, uint256 helpfulness, uint256 speed, uint256 safety) =
            registry.getReputation(AGENT_ID);

        assertEq(totalReviews, 2);
        assertEq(overallScore, 60);    // (100*1 + 20) / 2 = 60
        assertEq(accuracy, 60);
        assertEq(helpfulness, 60);
        assertEq(speed, 60);
        assertEq(safety, 60);
    }

    function test_detailedFeedback_integerDivisionPrecisionLoss() public {
        // Demonstrate precision loss with integer division
        // First: rating=5 → score 100
        vm.prank(alice);
        registry.submitDetailedFeedback(AGENT_ID, 5, 5, 5, 5, 5, keccak256("1"));

        // Second: rating=4 → score 80
        // Avg should be 90, but: (100*1 + 80) / 2 = 90 (exact here)
        vm.prank(bob);
        registry.submitDetailedFeedback(AGENT_ID, 4, 4, 4, 4, 4, keccak256("2"));

        // Third: rating=3 → score 60
        // Avg should be 80, but: (90*2 + 60) / 3 = 240/3 = 80 (exact here)
        vm.prank(charlie);
        registry.submitDetailedFeedback(AGENT_ID, 3, 3, 3, 3, 3, keccak256("3"));

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 3);
        assertEq(overallScore, 80);
    }

    function test_detailedFeedback_precisionLoss_oddDivision() public {
        // Case where precision loss actually occurs
        // First: rating=5 → score 100
        vm.prank(alice);
        registry.submitDetailedFeedback(AGENT_ID, 5, 5, 5, 5, 5, keccak256("1"));

        // Second: rating=2 → score 40
        // Expected average: (100 + 40) / 2 = 70
        // Actual: (100*1 + 40) / 2 = 70 (exact for 2 reviews)
        vm.prank(bob);
        registry.submitDetailedFeedback(AGENT_ID, 2, 2, 2, 2, 2, keccak256("2"));

        (uint256 overallScore, , , , , ) = registry.getReputation(AGENT_ID);
        assertEq(overallScore, 70);

        // Third: rating=1 → score 20
        // Expected average: (100 + 40 + 20) / 3 = 53.33
        // Actual: (70*2 + 20) / 3 = 160/3 = 53 (truncated from 53.33)
        vm.prank(charlie);
        registry.submitDetailedFeedback(AGENT_ID, 1, 1, 1, 1, 1, keccak256("3"));

        (overallScore, , , , , ) = registry.getReputation(AGENT_ID);
        // Integer division truncation: 160/3 = 53, not 53.33
        assertEq(overallScore, 53);
    }

    // ============ Mixed Simple + Detailed Feedback ============

    function test_mixedFeedback_simpleThenDetailed() public {
        // Simple feedback: adds to totalScore cumulatively
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 5, keccak256("simple"));

        // Detailed feedback uses weighted average based on totalReviews
        // count=1 (from simple), totalScore=100
        // New: (100*1 + 60) / 2 = 80
        vm.prank(bob);
        registry.submitDetailedFeedback(AGENT_ID, 3, 4, 3, 5, 2, keccak256("detailed"));

        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(AGENT_ID);
        assertEq(totalReviews, 2);
        assertEq(overallScore, 80);
    }

    // ============ getFeedback ============

    function test_getFeedback_returnsCorrectData() public {
        vm.warp(1000);
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 4, keccak256("good"));

        (address reviewer, uint8 rating, uint256 timestamp) = registry.getFeedback(AGENT_ID, 0);
        assertEq(reviewer, alice);
        assertEq(rating, 4);
        assertEq(timestamp, 1000);
    }

    function test_getFeedback_revertsOnInvalidIndex() public {
        vm.expectRevert("Invalid index");
        registry.getFeedback(AGENT_ID, 0);
    }

    function test_getFeedback_revertsOnOutOfBoundsIndex() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 3, keccak256("ok"));

        vm.expectRevert("Invalid index");
        registry.getFeedback(AGENT_ID, 1);
    }

    // ============ getFeedbackCount ============

    function test_getFeedbackCount_zero() public view {
        assertEq(registry.getFeedbackCount(AGENT_ID), 0);
    }

    function test_getFeedbackCount_increments() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 3, keccak256("1"));

        vm.prank(bob);
        registry.submitFeedback(AGENT_ID, 4, keccak256("2"));

        assertEq(registry.getFeedbackCount(AGENT_ID), 2);
    }

    // ============ getReputation for unreviewed agent ============

    function test_getReputation_unreviewedAgent() public view {
        (uint256 overallScore, uint256 totalReviews, , , , ) = registry.getReputation(999);
        assertEq(overallScore, 0);
        assertEq(totalReviews, 0);
    }

    // ============ Boundary Values ============

    function test_boundaryRating_1() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 1, keccak256("min"));

        (uint256 overallScore, , , , , ) = registry.getReputation(AGENT_ID);
        assertEq(overallScore, 20); // 1 * 20
    }

    function test_boundaryRating_5() public {
        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 5, keccak256("max"));

        (uint256 overallScore, , , , , ) = registry.getReputation(AGENT_ID);
        assertEq(overallScore, 100); // 5 * 20
    }

    // ============ hasReviewed mapping ============

    function test_hasReviewed_tracking() public {
        assertFalse(registry.hasReviewed(AGENT_ID, alice));

        vm.prank(alice);
        registry.submitFeedback(AGENT_ID, 3, keccak256("ok"));

        assertTrue(registry.hasReviewed(AGENT_ID, alice));
        assertFalse(registry.hasReviewed(AGENT_ID, bob));
    }
}
