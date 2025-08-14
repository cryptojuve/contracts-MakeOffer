// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Offers is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    bytes32 public constant OFFEROR_ROLE = keccak256("OFFEROR_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Offer {
        address offeror;
        address assetContract;
        uint256 tokenId;
        uint256 quantity;
        address currency;
        uint256 pricePerToken;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool cancelled;
        bool accepted;
        uint256 quantityAccepted;
    }

    mapping(uint256 => Offer) public offers;
    uint256 public totalOffers;

    event OfferCreated(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId, Offer offer);
    event OfferCancelled(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId);
    event OfferAccepted(uint256 indexed offerId, address indexed offeror, address indexed assetContract, uint256 tokenId, address seller, uint256 quantity, uint256 totalPrice);

    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OFFEROR_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);
        _setRoleAdmin(OFFEROR_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function createOffer(
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        address _currency,
        uint256 _pricePerToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp
    ) external whenNotPaused onlyRole(OFFEROR_ROLE) returns (uint256 offerId) {
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_startTimestamp < _endTimestamp, "Start time must be before end time");
        require(_startTimestamp >= block.timestamp, "Start time cannot be in the past");

        offerId = totalOffers;
        totalOffers++;

        offers[offerId] = Offer({
            offeror: msg.sender,
            assetContract: _assetContract,
            tokenId: _tokenId,
            quantity: _quantity,
            currency: _currency,
            pricePerToken: _pricePerToken,
            startTimestamp: _startTimestamp,
            endTimestamp: _endTimestamp,
            cancelled: false,
            accepted: false,
            quantityAccepted: 0
        });

        emit OfferCreated(offerId, msg.sender, _assetContract, _tokenId, offers[offerId]);
    }

    function cancelOffer(uint256 _offerId) external whenNotPaused {
        Offer storage offer = offers[_offerId];
        require(offer.offeror == msg.sender, "Not the offeror");
        require(!offer.cancelled, "Offer is already cancelled");
        require(!offer.accepted, "Offer is already accepted");

        offer.cancelled = true;

        emit OfferCancelled(_offerId, msg.sender, offer.assetContract, offer.tokenId);
    }

    function acceptOffer(uint256 _offerId, uint256 _quantity) external payable whenNotPaused nonReentrant {
        Offer storage offer = offers[_offerId];
        require(!offer.cancelled, "Offer is cancelled");
        require(!offer.accepted, "Offer is already accepted");
        require(block.timestamp >= offer.startTimestamp, "Offer has not started yet");
        require(block.timestamp <= offer.endTimestamp, "Offer has ended");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_quantity <= offer.quantity - offer.quantityAccepted, "Insufficient quantity available");

        // Check if seller owns the NFT
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            require(IERC721(offer.assetContract).ownerOf(offer.tokenId) == msg.sender, "Not the owner");
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            require(IERC1155(offer.assetContract).balanceOf(msg.sender, offer.tokenId) >= _quantity, "Insufficient balance");
        }

        uint256 totalPrice = _quantity * offer.pricePerToken;

        // Transfer payment from offeror to seller
        if (offer.currency == address(0)) {
            // Native token (HYPE)
            require(msg.value == 0, "No native token payment for accepting offers");
            // The offeror should have already sent the payment
        } else {
            // ERC20 token
            require(msg.value == 0, "No native token payment for accepting offers");
            IERC20(offer.currency).transferFrom(offer.offeror, msg.sender, totalPrice);
        }

        // Transfer NFT from seller to offeror
        if (IERC165(offer.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            IERC721(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, offer.tokenId);
        } else if (IERC165(offer.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(offer.assetContract).safeTransferFrom(msg.sender, offer.offeror, offer.tokenId, _quantity, "");
        }

        offer.quantityAccepted += _quantity;

        // Check if offer is complete
        if (offer.quantityAccepted == offer.quantity) {
            offer.accepted = true;
        }

        emit OfferAccepted(_offerId, offer.offeror, offer.assetContract, offer.tokenId, msg.sender, _quantity, totalPrice);
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
}
