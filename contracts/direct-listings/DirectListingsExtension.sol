// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

/// @author thirdweb

import "../IMarketplace.sol";
import "lib/contracts/contracts/extension/upgradeable/Permissions.sol";
import "lib/contracts/contracts/extension/upgradeable/ReentrancyGuard.sol";
import "lib/contracts/contracts/eip/interface/IERC165.sol";
import "lib/contracts/contracts/eip/interface/IERC721.sol";
import "lib/contracts/contracts/eip/interface/IERC1155.sol";
import "lib/contracts/contracts/eip/interface/IERC20.sol";
import "lib/contracts/contracts/lib/CurrencyTransferLib.sol";

/**
 * @author  thirdweb.com
 * @notice  Extension contract for DirectListings functionality
 * @dev     Complete implementation with full logic including token transfers and payments
 */
contract DirectListingsExtension is IDirectListings, ReentrancyGuard, Permissions {

    /*///////////////////////////////////////////////////////////////
                        Constants / Immutables
    //////////////////////////////////////////////////////////////*/

    /// @dev Only lister role holders can create listings, when listings are restricted by lister address.
    bytes32 private constant LISTER_ROLE = keccak256("LISTER_ROLE");
    /// @dev Only assets from NFT contracts with asset role can be listed, when listings are restricted by asset address.
    bytes32 private constant ASSET_ROLE = keccak256("ASSET_ROLE");

    /// @dev The address of the native token wrapper contract.
    address private immutable nativeTokenWrapper;

    /// @dev HYPE token unit (1 HYPE = 10^18 wei)
    uint256 private constant HYPE = 10**18;

    /*///////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from listingId => listing info.
    mapping(uint256 => Listing) public listings;

    /// @dev Mapping from listingId => buyer address => whether buyer is approved to buy from listing.
    mapping(uint256 => mapping(address => bool)) public isBuyerApprovedForListing;

    /// @dev Mapping from listingId => currency => price per token in that currency.
    mapping(uint256 => mapping(address => uint256)) public currencyPriceForListing;

    /// @dev The next listing ID to assign to a new listing.
    uint256 private nextListingId;

    /*///////////////////////////////////////////////////////////////
                            Modifier
    //////////////////////////////////////////////////////////////*/

    /// @dev Checks whether the caller has LISTER_ROLE.
    modifier onlyListerRole() {
        require(hasRoleWithSwitch(LISTER_ROLE, _msgSender()), "!LISTER_ROLE");
        _;
    }

    /// @dev Checks whether the caller has ASSET_ROLE.
    modifier onlyAssetRole(address _asset) {
        require(hasRoleWithSwitch(ASSET_ROLE, _asset), "!ASSET_ROLE");
        _;
    }

    /// @dev Checks whether caller is a listing creator.
    modifier onlyListingCreator(uint256 _listingId) {
        require(
            listings[_listingId].listingCreator == _msgSender(),
            "Marketplace: not listing creator."
        );
        _;
    }

    /// @dev Checks whether a listing exists.
    modifier onlyExistingListing(uint256 _listingId) {
        require(
            listings[_listingId].status == Status.CREATED,
            "Marketplace: invalid listing."
        );
        _;
    }

    /*///////////////////////////////////////////////////////////////
                            Constructor
    //////////////////////////////////////////////////////////////*/

    constructor(address _nativeTokenWrapper) {
        nativeTokenWrapper = _nativeTokenWrapper;
        _initializeRoles();
    }

    /*///////////////////////////////////////////////////////////////
                            Internal functions
    //////////////////////////////////////////////////////////////*/

    /// @dev Initialize the roles for the contract
    function _initializeRoles() internal {
        // Set the deployer as the default admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Set DEFAULT_ADMIN_ROLE as admin for LISTER_ROLE and ASSET_ROLE
        _setRoleAdmin(LISTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ASSET_ROLE, DEFAULT_ADMIN_ROLE);

        // Grant LISTER_ROLE to the deployer by default
        _setupRole(LISTER_ROLE, msg.sender);

        // Grant ASSET_ROLE to address(0) to disable asset restrictions by default
        // This allows any NFT contract to be listed initially
        _setupRole(ASSET_ROLE, address(0));
    }

    /*///////////////////////////////////////////////////////////////
                            External functions
    //////////////////////////////////////////////////////////////*/

    /// @notice List NFTs (ERC721 or ERC1155) for sale at a fixed price.
    function createListing(ListingParameters calldata _params)
        external
        onlyListerRole
        onlyAssetRole(_params.assetContract)
        returns (uint256 listingId)
    {
        listingId = _getNextListingId();
        address listingCreator = _msgSender();
        TokenType tokenType = _getTokenType(_params.assetContract);

        uint128 startTime = _params.startTimestamp;
        uint128 endTime = _params.endTimestamp;
        require(startTime < endTime, "Marketplace: endTimestamp not greater than startTimestamp.");
        if (startTime < block.timestamp) {
            startTime = uint128(block.timestamp);
        }

        require(_params.quantity > 0, "Marketplace: quantity must be greater than 0.");
        require(_params.pricePerToken > 0, "Marketplace: price per token must be greater than 0.");

        if (tokenType == TokenType.ERC721) {
            require(_params.quantity == 1, "Marketplace: ERC721 listings can only have quantity 1.");
        }

        Listing memory listing = Listing({
            listingId: listingId,
            listingCreator: listingCreator,
            assetContract: _params.assetContract,
            tokenId: _params.tokenId,
            quantity: _params.quantity,
            currency: _params.currency,
            pricePerToken: _params.pricePerToken,
            startTimestamp: startTime,
            endTimestamp: endTime,
            reserved: _params.reserved,
            tokenType: tokenType,
            status: Status.CREATED
        });

        listings[listingId] = listing;

        emit NewListing(listingCreator, listingId, _params.assetContract, listing);
    }

    function updateListing(uint256 _listingId, ListingParameters calldata _params)
        external
        onlyListingCreator(_listingId)
        onlyExistingListing(_listingId)
    {
        require(_params.quantity > 0, "Marketplace: quantity must be greater than 0.");
        require(_params.pricePerToken > 0, "Marketplace: price per token must be greater than 0.");

        TokenType tokenType = _getTokenType(_params.assetContract);
        if (tokenType == TokenType.ERC721) {
            require(_params.quantity == 1, "Marketplace: ERC721 listings can only have quantity 1.");
        }

        uint128 startTime = _params.startTimestamp;
        uint128 endTime = _params.endTimestamp;
        require(startTime < endTime, "Marketplace: endTimestamp not greater than startTimestamp.");

        Listing storage listing = listings[_listingId];
        listing.assetContract = _params.assetContract;
        listing.tokenId = _params.tokenId;
        listing.quantity = _params.quantity;
        listing.currency = _params.currency;
        listing.pricePerToken = _params.pricePerToken;
        listing.startTimestamp = startTime;
        listing.endTimestamp = endTime;
        listing.reserved = _params.reserved;
        listing.tokenType = tokenType;

        emit UpdatedListing(_msgSender(), _listingId, _params.assetContract, listing);
    }

    function cancelListing(uint256 _listingId) external onlyListingCreator(_listingId) onlyExistingListing(_listingId) {
        listings[_listingId].status = Status.CANCELLED;
        emit CancelledListing(_msgSender(), _listingId);
    }

    function buyFromListing(
        uint256 _listingId,
        address _buyFor,
        uint256 _quantity,
        address _currency,
        uint256 _expectedTotalPrice
    ) external payable onlyExistingListing(_listingId) {
        Listing memory listing = listings[_listingId];
        require(listing.status == Status.CREATED, "Marketplace: listing not active.");
        require(block.timestamp >= listing.startTimestamp && block.timestamp < listing.endTimestamp, "Marketplace: listing not active.");
        require(_quantity > 0 && _quantity <= listing.quantity, "Marketplace: invalid quantity.");
        require(_currency == listing.currency, "Marketplace: currency mismatch.");

        uint256 totalPrice = listing.pricePerToken * _quantity;
        require(_expectedTotalPrice == totalPrice, "Marketplace: price mismatch.");

        if (listing.reserved) {
            require(isBuyerApprovedForListing[_listingId][_buyFor], "Marketplace: buyer not approved.");
        }

        // Validate payment for native token (HYPE on HyperEVM)
        if (_currency == CurrencyTransferLib.NATIVE_TOKEN) {
            require(msg.value == totalPrice, "Marketplace: incorrect payment amount");
        } else {
            require(msg.value == 0, "Marketplace: no native token should be sent for ERC20 payments");
        }

        // Validate ownership and approval before proceeding
        _validateOwnershipAndApproval(
            listing.listingCreator,
            listing.assetContract,
            listing.tokenId,
            _quantity,
            listing.tokenType
        );

        // Transfer tokens from seller to buyer
        _transferTokens(
            listing.listingCreator,
            _buyFor,
            listing.assetContract,
            listing.tokenId,
            _quantity,
            listing.tokenType
        );

        // Handle payment
        _handlePayment(_currency, totalPrice, listing.listingCreator);

        // Update listing
        if (_quantity == listing.quantity) {
            listings[_listingId].status = Status.COMPLETED;
        } else {
            listings[_listingId].quantity -= _quantity;
        }

        emit NewSale(listing.listingCreator, _listingId, listing.assetContract, listing.tokenId, _buyFor, _quantity, totalPrice);
    }

    function getListing(uint256 _listingId) external view returns (Listing memory) {
        return listings[_listingId];
    }

    function getAllListings(uint256 _startId, uint256 _endId) external view returns (Listing[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Listing[] memory _listings = new Listing[](count);

        for (uint256 i = 0; i < count; i++) {
            _listings[i] = listings[_startId + i];
        }

        return _listings;
    }

    function getAllListingsByCreator(address _creator, uint256 _startId, uint256 _endId) external view returns (Listing[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Listing[] memory _listings = new Listing[](count);
        uint256 found = 0;

        for (uint256 i = _startId; i <= _endId; i++) {
            if (listings[i].listingCreator == _creator) {
                _listings[found] = listings[i];
                found++;
            }
        }

        // Resize array to actual found count
        assembly {
            mstore(_listings, found)
        }

        return _listings;
    }

    function getAllListingsByAsset(address _assetContract, uint256 _startId, uint256 _endId) external view returns (Listing[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Listing[] memory _listings = new Listing[](count);
        uint256 found = 0;

        for (uint256 i = _startId; i <= _endId; i++) {
            if (listings[i].assetContract == _assetContract) {
                _listings[found] = listings[i];
                found++;
            }
        }

        // Resize array to actual found count
        assembly {
            mstore(_listings, found)
        }

        return _listings;
    }

    function approveBuyerForListing(uint256 _listingId, address _buyer, bool _toApprove) external onlyListingCreator(_listingId) {
        isBuyerApprovedForListing[_listingId][_buyer] = _toApprove;
        emit BuyerApprovedForListing(_listingId, _buyer, _toApprove);
    }

    function approveCurrencyForListing(uint256 _listingId, address _currency, uint256 _pricePerTokenInCurrency) external onlyListingCreator(_listingId) {
        currencyPriceForListing[_listingId][_currency] = _pricePerTokenInCurrency;
        emit CurrencyApprovedForListing(_listingId, _currency, _pricePerTokenInCurrency);
    }

    function getAllValidListings(uint256 _startId, uint256 _endId) external view returns (Listing[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Listing[] memory _listings = new Listing[](count);
        uint256 found = 0;

        for (uint256 i = _startId; i <= _endId; i++) {
            if (listings[i].status == Status.CREATED) {
                _listings[found] = listings[i];
                found++;
            }
        }

        // Resize array to actual found count
        assembly {
            mstore(_listings, found)
        }

        return _listings;
    }

    function totalListings() external view returns (uint256) {
        return nextListingId;
    }

    // Helper functions
    function _getTokenType(address _assetContract) internal view returns (TokenType) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool supported) {
            if (supported) return TokenType.ERC721;
        } catch {}

        try IERC165(_assetContract).supportsInterface(type(IERC1155).interfaceId) returns (bool supported) {
            if (supported) return TokenType.ERC1155;
        } catch {}

        revert("Marketplace: unsupported token type.");
    }

    function _getNextListingId() internal returns (uint256) {
        return nextListingId++;
    }

    function _validateOwnershipAndApproval(
        address _tokenOwner,
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        TokenType _tokenType
    ) internal view {
        if (_tokenType == TokenType.ERC721) {
            require(IERC721(_assetContract).ownerOf(_tokenId) == _tokenOwner, "Marketplace: not token owner.");
            require(
                IERC721(_assetContract).isApprovedForAll(_tokenOwner, address(this)) ||
                IERC721(_assetContract).getApproved(_tokenId) == address(this),
                "Marketplace: not approved."
            );
        } else if (_tokenType == TokenType.ERC1155) {
            require(IERC1155(_assetContract).balanceOf(_tokenOwner, _tokenId) >= _quantity, "Marketplace: insufficient balance.");
            require(IERC1155(_assetContract).isApprovedForAll(_tokenOwner, address(this)), "Marketplace: not approved.");
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

    function _handlePayment(address _currency, uint256 _amount, address _recipient) internal {
        if (_currency == CurrencyTransferLib.NATIVE_TOKEN) {
            require(msg.value == _amount, "Marketplace: insufficient payment.");
            CurrencyTransferLib.safeTransferNativeToken(_recipient, _amount);
        } else {
            require(msg.value == 0, "Marketplace: no native token should be sent for ERC20 payments.");
            CurrencyTransferLib.safeTransferERC20(_currency, _msgSender(), _recipient, _amount);
        }
    }

    function _directListingsStorage() internal view returns (address) {
        return address(this);
    }
}
