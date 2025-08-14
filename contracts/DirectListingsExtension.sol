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

contract DirectListingsExtension is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");
    bytes32 public constant ASSET_ROLE = keccak256("ASSET_ROLE");

    address public nativeTokenWrapper;

    struct Listing {
        address assetContract;
        uint256 tokenId;
        address lister;
        uint256 quantity;
        address currency;
        uint256 pricePerToken;
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool reserved;
        address reservedBuyer;
        uint256 quantitySold;
        bool cancelled;
        bool finalized;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public totalListings;

    event ListingCreated(uint256 indexed listingId, address indexed assetContract, uint256 indexed tokenId, address lister, Listing listing);
    event ListingUpdated(uint256 indexed listingId, address indexed assetContract, uint256 indexed tokenId, address lister, Listing listing);
    event ListingCancelled(uint256 indexed listingId, address indexed assetContract, uint256 indexed tokenId, address lister);
    event ListingSold(uint256 indexed listingId, address indexed assetContract, uint256 indexed tokenId, address lister, address buyer, uint256 quantity, uint256 totalPrice);
    event ListingFinalized(uint256 indexed listingId, address indexed assetContract, uint256 indexed tokenId, address lister);

    constructor(address _nativeTokenWrapper, address _admin) {
        nativeTokenWrapper = _nativeTokenWrapper;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(LISTER_ROLE, _admin);
        _setRoleAdmin(LISTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ASSET_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(ASSET_ROLE, address(0)); // Allow all assets by default
    }

    function createListing(
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        address _currency,
        uint256 _pricePerToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        bool _reserved,
        address _reservedBuyer
    ) external whenNotPaused onlyRole(LISTER_ROLE) returns (uint256 listingId) {
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_startTimestamp < _endTimestamp, "Start time must be before end time");
        require(_startTimestamp >= block.timestamp, "Start time cannot be in the past");

        if (_reserved) {
            require(_reservedBuyer != address(0), "Reserved buyer cannot be zero address");
        }

        listingId = totalListings;
        totalListings++;

        listings[listingId] = Listing({
            assetContract: _assetContract,
            tokenId: _tokenId,
            lister: msg.sender,
            quantity: _quantity,
            currency: _currency,
            pricePerToken: _pricePerToken,
            startTimestamp: _startTimestamp,
            endTimestamp: _endTimestamp,
            reserved: _reserved,
            reservedBuyer: _reservedBuyer,
            quantitySold: 0,
            cancelled: false,
            finalized: false
        });

        emit ListingCreated(listingId, _assetContract, _tokenId, msg.sender, listings[listingId]);
    }

    function updateListing(
        uint256 _listingId,
        uint256 _quantity,
        address _currency,
        uint256 _pricePerToken,
        uint256 _startTimestamp,
        uint256 _endTimestamp,
        bool _reserved,
        address _reservedBuyer
    ) external whenNotPaused {
        Listing storage listing = listings[_listingId];
        require(listing.lister == msg.sender, "Not the lister");
        require(!listing.cancelled, "Listing is cancelled");
        require(!listing.finalized, "Listing is finalized");
        require(block.timestamp < listing.startTimestamp, "Listing has already started");

        require(_quantity > 0, "Quantity must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        require(_startTimestamp < _endTimestamp, "Start time must be before end time");
        require(_startTimestamp >= block.timestamp, "Start time cannot be in the past");

        if (_reserved) {
            require(_reservedBuyer != address(0), "Reserved buyer cannot be zero address");
        }

        listing.quantity = _quantity;
        listing.currency = _currency;
        listing.pricePerToken = _pricePerToken;
        listing.startTimestamp = _startTimestamp;
        listing.endTimestamp = _endTimestamp;
        listing.reserved = _reserved;
        listing.reservedBuyer = _reservedBuyer;

        emit ListingUpdated(_listingId, listing.assetContract, listing.tokenId, msg.sender, listing);
    }

    function cancelListing(uint256 _listingId) external whenNotPaused {
        Listing storage listing = listings[_listingId];
        require(listing.lister == msg.sender, "Not the lister");
        require(!listing.cancelled, "Listing is already cancelled");
        require(!listing.finalized, "Listing is finalized");

        listing.cancelled = true;

        emit ListingCancelled(_listingId, listing.assetContract, listing.tokenId, msg.sender);
    }

    function buyListing(uint256 _listingId, uint256 _quantity) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[_listingId];
        require(!listing.cancelled, "Listing is cancelled");
        require(!listing.finalized, "Listing is finalized");
        require(block.timestamp >= listing.startTimestamp, "Listing has not started yet");
        require(block.timestamp <= listing.endTimestamp, "Listing has ended");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_quantity <= listing.quantity - listing.quantitySold, "Insufficient quantity available");

        if (listing.reserved) {
            require(msg.sender == listing.reservedBuyer, "Not the reserved buyer");
        }

        uint256 totalPrice = _quantity * listing.pricePerToken;

        if (listing.currency == address(0)) {
            // Native token (HYPE)
            require(msg.value >= totalPrice, "Insufficient payment");
            
            // Transfer excess payment back to buyer
            if (msg.value > totalPrice) {
                payable(msg.sender).sendValue(msg.value - totalPrice);
            }
        } else {
            // ERC20 token
            require(msg.value == 0, "No native token payment for ERC20 listing");
            IERC20(listing.currency).transferFrom(msg.sender, listing.lister, totalPrice);
        }

        // Transfer NFT to buyer
        if (IERC165(listing.assetContract).supportsInterface(type(IERC721).interfaceId)) {
            IERC721(listing.assetContract).safeTransferFrom(listing.lister, msg.sender, listing.tokenId);
        } else if (IERC165(listing.assetContract).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(listing.assetContract).safeTransferFrom(listing.lister, msg.sender, listing.tokenId, _quantity, "");
        }

        listing.quantitySold += _quantity;

        // Check if listing is complete
        if (listing.quantitySold == listing.quantity) {
            listing.finalized = true;
            emit ListingFinalized(_listingId, listing.assetContract, listing.tokenId, listing.lister);
        }

        emit ListingSold(_listingId, listing.assetContract, listing.tokenId, listing.lister, msg.sender, _quantity, totalPrice);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setNativeTokenWrapper(address _nativeTokenWrapper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nativeTokenWrapper = _nativeTokenWrapper;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
