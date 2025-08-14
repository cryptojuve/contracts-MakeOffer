// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Offers is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    bytes32 public constant OFFEROR_ROLE = keccak256("OFFEROR_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Offer {
        address offeror;
        address assetContract;
        uint256 tokenId;           // 0 = offre sur collection entière, >0 = offre sur token spécifique
        uint256 quantity;          // Quantité totale souhaitée
        uint256 pricePerToken;     // Prix par token
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool cancelled;
        bool accepted;
        uint256 quantityAccepted;
        uint256 totalValue;        // Total value locked in the offer
        bool isCollectionOffer;    // true = offre sur collection, false = offre sur token spécifique
    }

    mapping(uint256 => Offer) public offers;
    uint256 public totalOffers;

    event OfferCreated(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId, Offer offer);
    event OfferCancelled(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId);
    event OfferAccepted(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId, address seller, uint256 quantity, uint256 totalPrice);
    event OfferWithdrawn(uint256 indexed offerId, address indexed offeror, uint256 amount);

    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OFFEROR_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
        _setRoleAdmin(OFFEROR_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    // Fonction pour créer une offre sur un token spécifique
    function createTokenOffer(
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _pricePerToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external payable whenNotPaused onlyRole(OFFEROR_ROLE) returns (uint256 offerId) {
        require(_tokenId > 0, "Token ID must be greater than 0 for token offers");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_startTimestamp < _endTimestamp, "Start time must be before end time");
        require(_startTimestamp >= block.timestamp, "Start time cannot be in the past");

        uint256 totalValue = _quantity * _pricePerToken;
        require(msg.value == totalValue, "Incorrect payment amount");

        offerId = totalOffers;
        totalOffers++;

        offers[offerId] = Offer({
            offeror: msg.sender,
            assetContract: _assetContract,
            tokenId: _tokenId,
            quantity: _quantity,
            pricePerToken: _pricePerToken,
            startTimestamp: _startTimestamp,
            endTimestamp: _endTimestamp,
            cancelled: false,
            accepted: false,
            quantityAccepted: 0,
            totalValue: totalValue,
            isCollectionOffer: false
        });

        emit OfferCreated(offerId, msg.sender, _assetContract, _tokenId, offers[offerId]);
    }

    // Fonction pour créer une offre sur une collection entière
    function createCollectionOffer(
        address _assetContract,
        uint256 _quantity,
        uint256 _pricePerToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external payable whenNotPaused onlyRole(OFFEROR_ROLE) returns (uint256 offerId) {
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_startTimestamp < _endTimestamp, "Start time must be before end time");
        require(_startTimestamp >= block.timestamp, "Start time cannot be in the past");

        uint256 totalValue = _quantity * _pricePerToken;
        require(msg.value == totalValue, "Incorrect payment amount");

        offerId = totalOffers;
        totalOffers++;

        offers[offerId] = Offer({
            offeror: msg.sender,
            assetContract: _assetContract,
            tokenId: 0, // 0 indique une offre sur collection entière
            quantity: _quantity,
            pricePerToken: _pricePerToken,
            startTimestamp: _startTimestamp,
            endTimestamp: _endTimestamp,
            cancelled: false,
            accepted: false,
            quantityAccepted: 0,
            totalValue: totalValue,
            isCollectionOffer: true
        });

        emit OfferCreated(offerId, msg.sender, _assetContract, 0, offers[offerId]);
    }

    // Fonction pour accepter une offre sur un token spécifique
    function acceptTokenOffer(uint256 _offerId, uint256 _quantity) external whenNotPaused nonReentrant {
        Offer storage offer = offers[_offerId];
        require(!offer.cancelled, "Offer is cancelled");
        require(!offer.accepted, "Offer is already accepted");
        require(!offer.isCollectionOffer, "This is a collection offer, use acceptCollectionOffer");
        require(block.timestamp >= offer.startTimestamp, "Offer has not started yet");
        require(block.timestamp <= offer.endTimestamp, "Offer has ended");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_quantity <= offer.quantity - offer.quantityAccepted, "Insufficient quantity available");

        // Check if seller owns the specific NFT
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            require(IERC721(offer.assetContract).ownerOf(offer.tokenId) == msg.sender, "Not the owner of this token");
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            require(IERC1155(offer.assetContract).balanceOf(msg.sender, offer.tokenId) >= _quantity, "Insufficient balance of this token");
        }

        uint256 totalPrice = _quantity * offer.pricePerToken;

        // Transfer NFT from seller to offeror
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            IERC721(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, offer.tokenId);
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, offer.tokenId, _quantity, "");
        }

        // Transfer payment to seller
        payable(msg.sender).transfer(totalPrice);

        offer.quantityAccepted += _quantity;

        // Check if offer is complete
        if (offer.quantityAccepted == offer.quantity) {
            offer.accepted = true;
        }

        emit OfferAccepted(_offerId, offer.offeror, offer.assetContract, offer.tokenId, msg.sender, _quantity, totalPrice);
    }

    // Fonction pour accepter une offre sur collection (avec un token spécifique)
    function acceptCollectionOffer(uint256 _offerId, uint256 _tokenId, uint256 _quantity) external whenNotPaused nonReentrant {
        Offer storage offer = offers[_offerId];
        require(!offer.cancelled, "Offer is cancelled");
        require(!offer.accepted, "Offer is already accepted");
        require(offer.isCollectionOffer, "This is not a collection offer, use acceptTokenOffer");
        require(_tokenId > 0, "Token ID must be greater than 0");
        require(block.timestamp >= offer.startTimestamp, "Offer has not started yet");
        require(block.timestamp <= offer.endTimestamp, "Offer has ended");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_quantity <= offer.quantity - offer.quantityAccepted, "Insufficient quantity available");

        // Check if seller owns the specified NFT from the collection
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            require(IERC721(offer.assetContract).ownerOf(_tokenId) == msg.sender, "Not the owner of this token");
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            require(IERC1155(offer.assetContract).balanceOf(msg.sender, _tokenId) >= _quantity, "Insufficient balance of this token");
        }

        uint256 totalPrice = _quantity * offer.pricePerToken;

        // Transfer NFT from seller to offeror
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            IERC721(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, _tokenId);
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, _tokenId, _quantity, "");
        }

        // Transfer payment to seller
        payable(msg.sender).transfer(totalPrice);

        offer.quantityAccepted += _quantity;

        // Check if offer is complete
        if (offer.quantityAccepted == offer.quantity) {
            offer.accepted = true;
        }

        emit OfferAccepted(_offerId, offer.offeror, offer.assetContract, _tokenId, msg.sender, _quantity, totalPrice);
    }

    function cancelOffer(uint256 _offerId) external whenNotPaused {
        Offer storage offer = offers[_offerId];
        require(offer.offeror == msg.sender, "Not the offeror");
        require(!offer.cancelled, "Offer is already cancelled");
        require(!offer.accepted, "Offer is already accepted");

        offer.cancelled = true;

        // Refund the offeror
        uint256 refundAmount = offer.totalValue - (offer.quantityAccepted * offer.pricePerToken);
        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
            emit OfferWithdrawn(_offerId, msg.sender, refundAmount);
        }

        emit OfferCancelled(_offerId, msg.sender, offer.assetContract, offer.tokenId);
    }

    function withdrawOffer(uint256 _offerId) external whenNotPaused {
        Offer storage offer = offers[_offerId];
        require(offer.offeror == msg.sender, "Not the offeror");
        require(!offer.cancelled, "Offer is already cancelled");
        require(!offer.accepted, "Offer is already accepted");
        require(block.timestamp > offer.endTimestamp, "Offer has not ended yet");

        offer.cancelled = true;

        // Refund the offeror
        uint256 refundAmount = offer.totalValue - (offer.quantityAccepted * offer.pricePerToken);
        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
            emit OfferWithdrawn(_offerId, msg.sender, refundAmount);
        }

        emit OfferCancelled(_offerId, msg.sender, offer.assetContract, offer.tokenId);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Function to receive native tokens (HYPE)
    receive() external payable {
        // Allow receiving native tokens
    }

    // Emergency function to withdraw native tokens (admin only)
    function withdrawNativeTokens() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No native tokens to withdraw");

        payable(msg.sender).transfer(balance);
    }

    // View function to get offer details
    function getOffer(uint256 _offerId) external view returns (Offer memory) {
        return offers[_offerId];
    }

    // View function to get all offers for a specific asset
    function getOffersForAsset(address _assetContract, uint256 _tokenId) external view returns (uint256[] memory) {
        uint256[] memory assetOffers = new uint256[](totalOffers);
        uint256 count = 0;

        for (uint256 i = 0; i < totalOffers; i++) {
            if (offers[i].assetContract == _assetContract && offers[i].tokenId == _tokenId) {
                assetOffers[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = assetOffers[i];
        }

        return result;
    }

    // View function to get all collection offers for a specific asset contract
    function getCollectionOffers(address _assetContract) external view returns (uint256[] memory) {
        uint256[] memory collectionOffers = new uint256[](totalOffers);
        uint256 count = 0;

        for (uint256 i = 0; i < totalOffers; i++) {
            if (offers[i].assetContract == _assetContract && offers[i].isCollectionOffer) {
                collectionOffers[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = collectionOffers[i];
        }

        return result;
    }

    // View function to get all active offers (not cancelled, not accepted)
    function getActiveOffers() external view returns (uint256[] memory) {
        uint256[] memory activeOffers = new uint256[](totalOffers);
        uint256 count = 0;

        for (uint256 i = 0; i < totalOffers; i++) {
            if (!offers[i].cancelled && !offers[i].accepted) {
                activeOffers[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeOffers[i];
        }

        return result;
    }
}
