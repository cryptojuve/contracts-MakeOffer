// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import "lib/openzeppelin-contracts/contracts/utils/Address.sol";

/**
 * @title OffersOpenZeppelin
 * @dev Contract for handling NFT offers using OpenZeppelin
 * @dev Compatible with HyperEVM (HYPE token) and supports both ERC721 and ERC1155
 */
contract OffersOpenZeppelin is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    /*///////////////////////////////////////////////////////////////
                        Constants
    //////////////////////////////////////////////////////////////*/

    /// @dev Role for creating offers
    bytes32 public constant OFFEROR_ROLE = keccak256("OFFEROR_ROLE");
    /// @dev Role for managing the contract
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /*///////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    struct Offer {
        uint256 offerId;
        address assetContract;
        uint256 tokenId;
        uint256 quantity;
        address currency;
        uint256 totalPrice;
        uint256 expirationTimestamp;
        address offeror;
        bool active;
        TokenType tokenType;
    }

    enum TokenType {
        ERC721,
        ERC1155
    }

    mapping(uint256 => Offer) public offers;
    uint256 public nextOfferId;

    /// @dev Platform fee in basis points (e.g., 250 = 2.5%)
    uint16 public platformFeeBps;
    /// @dev Platform fee recipient
    address public platformFeeRecipient;

    /*///////////////////////////////////////////////////////////////
                            Events
    //////////////////////////////////////////////////////////////*/

    event NewOffer(
        address indexed offeror,
        uint256 indexed offerId,
        address indexed assetContract,
        Offer offer
    );

    event OfferAccepted(
        address indexed seller,
        uint256 indexed offerId,
        uint256 totalPrice,
        uint256 platformFee
    );

    event OfferCancelled(
        address indexed offeror,
        uint256 indexed offerId
    );

    event OfferUpdated(
        uint256 indexed offerId,
        uint256 newPrice,
        uint256 newExpiration
    );

    event PlatformFeeUpdated(
        uint16 oldFeeBps,
        uint16 newFeeBps,
        address oldRecipient,
        address newRecipient
    );

    /*///////////////////////////////////////////////////////////////
                            Modifiers
    //////////////////////////////////////////////////////////////*/

    modifier onlyOfferor(uint256 _offerId) {
        require(offers[_offerId].offeror == _msgSender(), "Offers: not offeror");
        _;
    }

    modifier onlyActiveOffer(uint256 _offerId) {
        require(offers[_offerId].active, "Offers: offer not active");
        _;
    }

    modifier onlyNotExpired(uint256 _offerId) {
        require(block.timestamp <= offers[_offerId].expirationTimestamp, "Offers: offer expired");
        _;
    }



    /*///////////////////////////////////////////////////////////////
                            Constructor
    //////////////////////////////////////////////////////////////*/

    constructor(address _admin, uint16 _platformFeeBps, address _platformFeeRecipient) {
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MANAGER_ROLE, _admin);

        // Set role hierarchy
        _setRoleAdmin(OFFEROR_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);

        // Set platform fee
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;
    }

    /*///////////////////////////////////////////////////////////////
                            External functions
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a new offer for an NFT
    /// @param _assetContract The NFT contract address
    /// @param _tokenId The token ID
    /// @param _quantity The quantity (1 for ERC721, >1 for ERC1155)
    /// @param _expirationTimestamp When the offer expires
    function makeOffer(
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _expirationTimestamp
    ) external payable whenNotPaused nonReentrant returns (uint256 offerId) {
        require(msg.value > 0, "Offers: amount must be greater than 0");
        require(_expirationTimestamp > block.timestamp, "Offers: invalid expiration");
        require(_quantity > 0, "Offers: quantity must be greater than 0");

        // Determine token type
        TokenType tokenType = _getTokenType(_assetContract);

        if (tokenType == TokenType.ERC721) {
            require(_quantity == 1, "Offers: ERC721 can only have quantity 1");
        }

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            offerId: offerId,
            assetContract: _assetContract,
            tokenId: _tokenId,
            quantity: _quantity,
            currency: address(0), // Native token only
            totalPrice: msg.value,
            expirationTimestamp: _expirationTimestamp,
            offeror: _msgSender(),
            active: true,
            tokenType: tokenType
        });

        emit NewOffer(_msgSender(), offerId, _assetContract, offers[offerId]);
    }

    /// @notice Accept an offer and transfer the NFT
    /// @param _offerId The ID of the offer to accept
    function acceptOffer(uint256 _offerId) external whenNotPaused nonReentrant {
        Offer storage offer = offers[_offerId];
        require(offer.active, "Offers: offer not active");
        require(block.timestamp <= offer.expirationTimestamp, "Offers: offer expired");

        // Check ownership and approval
        _validateOwnershipAndApproval(
            _msgSender(),
            offer.assetContract,
            offer.tokenId,
            offer.quantity,
            offer.tokenType
        );

        // Calculate platform fee
        uint256 platformFee = (offer.totalPrice * platformFeeBps) / 10000;
        uint256 sellerAmount = offer.totalPrice - platformFee;

        // Transfer NFT from seller to offeror
        _transferTokens(
            _msgSender(),
            offer.offeror,
            offer.assetContract,
            offer.tokenId,
            offer.quantity,
            offer.tokenType
        );

        // Transfer payment to seller (minus platform fee)
        payable(_msgSender()).sendValue(sellerAmount);

        // Transfer platform fee
        if (platformFee > 0) {
            payable(platformFeeRecipient).sendValue(platformFee);
        }

        // Mark offer as inactive
        offer.active = false;

        emit OfferAccepted(_msgSender(), _offerId, offer.totalPrice, platformFee);
    }

    /// @notice Cancel an offer and refund the offeror
    /// @param _offerId The ID of the offer to cancel
    function cancelOffer(uint256 _offerId) external whenNotPaused nonReentrant {
        Offer storage offer = offers[_offerId];
        require(offer.active, "Offers: offer not active");
        require(offer.offeror == _msgSender(), "Offers: not offeror");

        // Refund the offeror
        payable(offer.offeror).sendValue(offer.totalPrice);

        // Mark offer as inactive
        offer.active = false;

        emit OfferCancelled(_msgSender(), _offerId);
    }

    /// @notice Update an existing offer
    /// @param _offerId The ID of the offer to update
    /// @param _newPrice The new price for the offer
    /// @param _newExpiration The new expiration timestamp
    function updateOffer(
        uint256 _offerId,
        uint256 _newPrice,
        uint256 _newExpiration
    ) external payable whenNotPaused onlyOfferor(_offerId) onlyActiveOffer(_offerId) {
        require(_newPrice > 0, "Offers: price must be greater than 0");
        require(_newExpiration > block.timestamp, "Offers: invalid expiration");

        Offer storage offer = offers[_offerId];

        // Calculate price difference
        uint256 priceDifference;
        if (_newPrice > offer.totalPrice) {
            // Need to send more ETH
            priceDifference = _newPrice - offer.totalPrice;
            require(msg.value == priceDifference, "Offers: incorrect additional amount");
        } else if (_newPrice < offer.totalPrice) {
            // Need to refund excess ETH
            priceDifference = offer.totalPrice - _newPrice;
            payable(_msgSender()).sendValue(priceDifference);
        }

        // Update offer
        offer.totalPrice = _newPrice;
        offer.expirationTimestamp = _newExpiration;

        emit OfferUpdated(_offerId, _newPrice, _newExpiration);
    }

    /// @notice Get offer details
    /// @param _offerId The ID of the offer
    function getOffer(uint256 _offerId) external view returns (Offer memory) {
        return offers[_offerId];
    }

    /// @notice Get all active offers for a specific asset
    /// @param _assetContract The NFT contract address
    /// @param _tokenId The token ID
    function getActiveOffersForAsset(address _assetContract, uint256 _tokenId)
        external
        view
        returns (uint256[] memory)
    {
        uint256 count = 0;
        uint256[] memory tempOffers = new uint256[](nextOfferId);

        for (uint256 i = 0; i < nextOfferId; i++) {
            if (offers[i].active &&
                offers[i].assetContract == _assetContract &&
                offers[i].tokenId == _tokenId) {
                tempOffers[count] = i;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempOffers[i];
        }

        return result;
    }

    /// @notice Get all offers by a specific offeror
    /// @param _offeror The address of the offeror
    function getOffersByOfferor(address _offeror) external view returns (uint256[] memory) {
        uint256 count = 0;
        uint256[] memory tempOffers = new uint256[](nextOfferId);

        for (uint256 i = 0; i < nextOfferId; i++) {
            if (offers[i].offeror == _offeror) {
                tempOffers[count] = i;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempOffers[i];
        }

        return result;
    }

    /*///////////////////////////////////////////////////////////////
                            Admin functions
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause the contract
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Update platform fee settings
    /// @param _newFeeBps New platform fee in basis points
    /// @param _newRecipient New platform fee recipient
    function updatePlatformFee(uint16 _newFeeBps, address _newRecipient)
        external
        onlyRole(MANAGER_ROLE)
    {
        require(_newFeeBps <= 1000, "Offers: fee cannot exceed 10%");
        require(_newRecipient != address(0), "Offers: invalid recipient");

        uint16 oldFeeBps = platformFeeBps;
        address oldRecipient = platformFeeRecipient;

        platformFeeBps = _newFeeBps;
        platformFeeRecipient = _newRecipient;

        emit PlatformFeeUpdated(oldFeeBps, _newFeeBps, oldRecipient, _newRecipient);
    }

    /// @notice Grant OFFEROR_ROLE to an address
    /// @param _offeror The address to grant the role to
    function grantOfferorRole(address _offeror) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OFFEROR_ROLE, _offeror);
    }

    /// @notice Revoke OFFEROR_ROLE from an address
    /// @param _offeror The address to revoke the role from
    function revokeOfferorRole(address _offeror) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OFFEROR_ROLE, _offeror);
    }

    /*///////////////////////////////////////////////////////////////
                            Internal functions
    //////////////////////////////////////////////////////////////*/

    function _getTokenType(address _assetContract) internal view returns (TokenType) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool supported) {
            if (supported) return TokenType.ERC721;
        } catch {}

        try IERC165(_assetContract).supportsInterface(type(IERC1155).interfaceId) returns (bool supported) {
            if (supported) return TokenType.ERC1155;
        } catch {}

        revert("Offers: unsupported token type");
    }

    function _validateOwnershipAndApproval(
        address _tokenOwner,
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        TokenType _tokenType
    ) internal view {
        if (_tokenType == TokenType.ERC721) {
            require(IERC721(_assetContract).ownerOf(_tokenId) == _tokenOwner, "Offers: not token owner");
            require(
                IERC721(_assetContract).isApprovedForAll(_tokenOwner, address(this)) ||
                IERC721(_assetContract).getApproved(_tokenId) == address(this),
                "Offers: not approved"
            );
        } else if (_tokenType == TokenType.ERC1155) {
            require(IERC1155(_assetContract).balanceOf(_tokenOwner, _tokenId) >= _quantity, "Offers: insufficient balance");
            require(IERC1155(_assetContract).isApprovedForAll(_tokenOwner, address(this)), "Offers: not approved");
        }
    }

    function _transferTokens(
        address _from,
        address _to,
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        TokenType _tokenType
    ) internal {
        if (_tokenType == TokenType.ERC721) {
            IERC721(_assetContract).safeTransferFrom(_from, _to, _tokenId);
        } else if (_tokenType == TokenType.ERC1155) {
            IERC1155(_assetContract).safeTransferFrom(_from, _to, _tokenId, _quantity, "");
        }
    }

    /*///////////////////////////////////////////////////////////////
                            Receive function
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        // Accept HYPE and WHYPE via fallback
    }
}
