// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 compliant identity registry for AI agents
 * @dev Each agent is represented as an NFT with associated metadata
 */
contract IdentityRegistry is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1; // Start at 1 so walletToToken==0 means "not registered"

    struct AgentIdentity {
        address agentWallet;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(uint256 => AgentIdentity) public agents;
    mapping(address => uint256) public walletToToken;

    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        address agentWallet
    );
    event AgentUpdated(uint256 indexed tokenId, string metadataUri);
    event AgentDeactivated(uint256 indexed tokenId);
    event AgentReactivated(uint256 indexed tokenId);

    constructor() ERC721("Straits Agent", "SAGENT") Ownable(msg.sender) {}

    /**
     * @notice Register a new agent
     * @param agentWallet The wallet address of the agent
     * @param metadataUri IPFS URI containing agent metadata
     * @return tokenId The ID of the newly minted agent NFT
     */
    function registerAgent(
        address agentWallet,
        string memory metadataUri
    ) external returns (uint256) {
        require(agentWallet != address(0), "Invalid agent wallet");
        require(walletToToken[agentWallet] == 0, "Agent wallet already registered");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataUri);

        agents[tokenId] = AgentIdentity({
            agentWallet: agentWallet,
            isActive: true,
            registeredAt: block.timestamp
        });

        walletToToken[agentWallet] = tokenId;

        emit AgentRegistered(tokenId, msg.sender, agentWallet);
        return tokenId;
    }

    /**
     * @notice Update agent metadata
     * @param tokenId The agent's token ID
     * @param metadataUri New IPFS URI for metadata
     */
    function updateMetadata(
        uint256 tokenId,
        string memory metadataUri
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        _setTokenURI(tokenId, metadataUri);
        emit AgentUpdated(tokenId, metadataUri);
    }

    /**
     * @notice Deactivate an agent
     * @param tokenId The agent's token ID
     */
    function deactivateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(agents[tokenId].isActive, "Agent already inactive");
        agents[tokenId].isActive = false;
        emit AgentDeactivated(tokenId);
    }

    /**
     * @notice Reactivate an agent
     * @param tokenId The agent's token ID
     */
    function reactivateAgent(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        require(!agents[tokenId].isActive, "Agent already active");
        agents[tokenId].isActive = true;
        emit AgentReactivated(tokenId);
    }

    /**
     * @notice Get agent details
     * @param tokenId The agent's token ID
     */
    function getAgent(
        uint256 tokenId
    )
        external
        view
        returns (
            address owner,
            address agentWallet,
            string memory metadataUri,
            bool isActive
        )
    {
        require(tokenId < _nextTokenId, "Agent does not exist");
        AgentIdentity memory agent = agents[tokenId];
        return (
            ownerOf(tokenId),
            agent.agentWallet,
            tokenURI(tokenId),
            agent.isActive
        );
    }

    /**
     * @notice Check if an agent is active
     * @param tokenId The agent's token ID
     */
    function isAgentActive(uint256 tokenId) external view returns (bool) {
        return agents[tokenId].isActive;
    }

    // Override required functions
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
