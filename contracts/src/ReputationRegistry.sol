// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationRegistry
 * @notice On-chain reputation tracking for AI agents
 */
contract ReputationRegistry is Ownable {
    struct ReputationScore {
        uint256 totalScore;
        uint256 totalReviews;
        uint256 accuracyScore;
        uint256 helpfulnessScore;
        uint256 speedScore;
        uint256 safetyScore;
        uint256 lastUpdated;
    }

    struct Feedback {
        address reviewer;
        uint8 rating;
        bytes32 commentHash;
        uint256 timestamp;
    }

    mapping(uint256 => ReputationScore) public reputations;
    mapping(uint256 => Feedback[]) public feedbackHistory;
    mapping(uint256 => mapping(address => bool)) public hasReviewed;

    uint256 private _nextFeedbackId;

    event FeedbackSubmitted(
        uint256 indexed feedbackId,
        uint256 indexed agentTokenId,
        address indexed reviewer,
        uint8 rating
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Submit feedback for an agent
     * @param agentTokenId The agent's token ID from IdentityRegistry
     * @param rating Rating from 1-5
     * @param commentHash Hash of the comment (stored off-chain)
     */
    function submitFeedback(
        uint256 agentTokenId,
        uint8 rating,
        bytes32 commentHash
    ) external returns (uint256) {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(!hasReviewed[agentTokenId][msg.sender], "Already reviewed");

        uint256 feedbackId = _nextFeedbackId++;

        Feedback memory feedback = Feedback({
            reviewer: msg.sender,
            rating: rating,
            commentHash: commentHash,
            timestamp: block.timestamp
        });

        feedbackHistory[agentTokenId].push(feedback);
        hasReviewed[agentTokenId][msg.sender] = true;

        // Update reputation score
        ReputationScore storage rep = reputations[agentTokenId];
        rep.totalScore += rating * 20; // Convert 1-5 to 20-100
        rep.totalReviews++;
        rep.lastUpdated = block.timestamp;

        emit FeedbackSubmitted(feedbackId, agentTokenId, msg.sender, rating);
        return feedbackId;
    }

    /**
     * @notice Submit detailed feedback with category scores
     * @param agentTokenId The agent's token ID
     * @param rating Overall rating (1-5)
     * @param accuracy Accuracy score (1-5)
     * @param helpfulness Helpfulness score (1-5)
     * @param speed Speed score (1-5)
     * @param safety Safety score (1-5)
     * @param commentHash Hash of the comment
     */
    function submitDetailedFeedback(
        uint256 agentTokenId,
        uint8 rating,
        uint8 accuracy,
        uint8 helpfulness,
        uint8 speed,
        uint8 safety,
        bytes32 commentHash
    ) external returns (uint256) {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(accuracy >= 1 && accuracy <= 5, "Accuracy must be 1-5");
        require(helpfulness >= 1 && helpfulness <= 5, "Helpfulness must be 1-5");
        require(speed >= 1 && speed <= 5, "Speed must be 1-5");
        require(safety >= 1 && safety <= 5, "Safety must be 1-5");
        require(!hasReviewed[agentTokenId][msg.sender], "Already reviewed");

        uint256 feedbackId = _nextFeedbackId++;

        Feedback memory feedback = Feedback({
            reviewer: msg.sender,
            rating: rating,
            commentHash: commentHash,
            timestamp: block.timestamp
        });

        feedbackHistory[agentTokenId].push(feedback);
        hasReviewed[agentTokenId][msg.sender] = true;

        // Update reputation score with weighted averages
        ReputationScore storage rep = reputations[agentTokenId];
        uint256 count = rep.totalReviews;

        rep.totalScore = ((rep.totalScore * count) + (rating * 20)) / (count + 1);
        rep.accuracyScore = ((rep.accuracyScore * count) + (accuracy * 20)) / (count + 1);
        rep.helpfulnessScore = ((rep.helpfulnessScore * count) + (helpfulness * 20)) / (count + 1);
        rep.speedScore = ((rep.speedScore * count) + (speed * 20)) / (count + 1);
        rep.safetyScore = ((rep.safetyScore * count) + (safety * 20)) / (count + 1);
        rep.totalReviews++;
        rep.lastUpdated = block.timestamp;

        emit FeedbackSubmitted(feedbackId, agentTokenId, msg.sender, rating);
        return feedbackId;
    }

    /**
     * @notice Get reputation score for an agent
     * @param agentTokenId The agent's token ID
     */
    function getReputation(
        uint256 agentTokenId
    )
        external
        view
        returns (
            uint256 overallScore,
            uint256 totalReviews,
            uint256 accuracyScore,
            uint256 helpfulnessScore,
            uint256 speedScore,
            uint256 safetyScore
        )
    {
        ReputationScore memory rep = reputations[agentTokenId];
        return (
            rep.totalReviews > 0 ? rep.totalScore : 0,
            rep.totalReviews,
            rep.accuracyScore,
            rep.helpfulnessScore,
            rep.speedScore,
            rep.safetyScore
        );
    }

    /**
     * @notice Get feedback count for an agent
     * @param agentTokenId The agent's token ID
     */
    function getFeedbackCount(uint256 agentTokenId) external view returns (uint256) {
        return feedbackHistory[agentTokenId].length;
    }

    /**
     * @notice Get specific feedback entry
     * @param agentTokenId The agent's token ID
     * @param index The feedback index
     */
    function getFeedback(
        uint256 agentTokenId,
        uint256 index
    )
        external
        view
        returns (
            address reviewer,
            uint8 rating,
            uint256 timestamp
        )
    {
        require(index < feedbackHistory[agentTokenId].length, "Invalid index");
        Feedback memory fb = feedbackHistory[agentTokenId][index];
        return (fb.reviewer, fb.rating, fb.timestamp);
    }
}
