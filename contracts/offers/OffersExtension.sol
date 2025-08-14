// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

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
 * @notice  Extension contract for Offers functionality
 * @dev     Complete implementation with full logic including token transfers and payments
 */
contract OffersExtension is IOffers, ReentrancyGuard, Permissions {

    /*///////////////////////////////////////////////////////////////
                        Constants / Immutables
    //////////////////////////////////////////////////////////////*/

    /// @dev Can create offer for only assets from NFT contracts with asset role, when offers are restricted by asset address.
    bytes32 private constant ASSET_ROLE = keccak256("ASSET_ROLE");

    /// @dev HYPE token unit (1 HYPE = 10^18 wei)
    uint256 private constant HYPE = 10**18;

    /*///////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from offerId => offer info.
    mapping(uint256 => Offer) public offers;

    /// @dev The next offer ID to assign to a new offer.
    uint256 private nextOfferId;

    /// @dev Total number of offers created.
    uint256 public totalOffers;

    /*///////////////////////////////////////////////////////////////
                              Modifiers
    //////////////////////////////////////////////////////////////*/

    modifier onlyAssetRole(address _asset) {
        require(hasRoleWithSwitch(ASSET_ROLE, _asset), "!ASSET_ROLE");
        _;
    }

    /// @dev Checks whether caller is a offer creator.
    modifier onlyOfferor(uint256 _offerId) {
        require(offers[_offerId].offeror == _msgSender(), "!Offeror");
        _;
    }

    /// @dev Checks whether an offer exists.
    modifier onlyExistingOffer(uint256 _offerId) {
        require(offers[_offerId].status == OffersStatus.CREATED, "Marketplace: invalid offer.");
        _;
    }

    /*///////////////////////////////////////////////////////////////
                            Constructor
    //////////////////////////////////////////////////////////////*/

    constructor() {}

    /*///////////////////////////////////////////////////////////////
                            External functions
    //////////////////////////////////////////////////////////////*/

    function makeOffer(OfferParams memory _params) external payable returns (uint256 _offerId) {
        _offerId = _getNextOfferId();
        address _offeror = _msgSender();
        OffersTokenType _tokenType = _getTokenType(_params.assetContract);

        _validateNewOffer(_params, _tokenType);

        // Validate payment for native token offers (HYPE on HyperEVM)
        if (_params.currency == CurrencyTransferLib.NATIVE_TOKEN) {
            require(msg.value == _params.totalPrice, "Marketplace: incorrect payment amount");
        } else {
            require(msg.value == 0, "Marketplace: no native token should be sent for ERC20 offers");
        }

        Offer memory _offer = Offer({
            offerId: _offerId,
            offeror: _offeror,
            assetContract: _params.assetContract,
            tokenId: _params.tokenId,
            tokenType: _tokenType,
            quantity: _params.quantity,
            currency: _params.currency,
            totalPrice: _params.totalPrice,
            expirationTimestamp: _params.expirationTimestamp,
            status: OffersStatus.CREATED
        });

        offers[_offerId] = _offer;
        totalOffers++;

        emit NewOffer(_offeror, _offerId, _params.assetContract, _offer);
    }

    function cancelOffer(uint256 _offerId) external onlyExistingOffer(_offerId) onlyOfferor(_offerId) {
        offers[_offerId].status = OffersStatus.CANCELLED;
        emit CancelledOffer(_msgSender(), _offerId);
    }

    function acceptOffer(uint256 _offerId) external nonReentrant onlyExistingOffer(_offerId) {
        Offer memory _targetOffer = offers[_offerId];

        require(_targetOffer.expirationTimestamp > block.timestamp, "EXPIRED");

        // Validate ERC20 balance and allowance
        require(
            _validateERC20BalAndAllowance(_targetOffer.offeror, _targetOffer.currency, _targetOffer.totalPrice),
            "Marketplace: insufficient currency balance."
        );

        // Validate ownership and approval of the token being offered on
        _validateOwnershipAndApproval(
            _msgSender(),
            _targetOffer.assetContract,
            _targetOffer.tokenId,
            _targetOffer.quantity,
            _targetOffer.tokenType
        );

        // Update offer status
        offers[_offerId].status = OffersStatus.COMPLETED;

        // Handle payment from offeror to token owner
        _payout(_targetOffer.offeror, _msgSender(), _targetOffer.currency, _targetOffer.totalPrice, _targetOffer);

        // Transfer tokens from token owner to offeror
        _transferOfferTokens(_msgSender(), _targetOffer.offeror, _targetOffer.quantity, _targetOffer);

        emit AcceptedOffer(
            _targetOffer.offeror,
            _targetOffer.offerId,
            _targetOffer.assetContract,
            _targetOffer.tokenId,
            _msgSender(),
            _targetOffer.quantity,
            _targetOffer.totalPrice
        );
    }

    function getOffer(uint256 _offerId) external view returns (Offer memory) {
        return offers[_offerId];
    }

    function getAllOffers(uint256 _startId, uint256 _endId) external view returns (Offer[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Offer[] memory _offers = new Offer[](count);

        for (uint256 i = 0; i < count; i++) {
            _offers[i] = offers[_startId + i];
        }

        return _offers;
    }

    function getAllOffersByOfferor(address _offeror, uint256 _startId, uint256 _endId) external view returns (Offer[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Offer[] memory _offers = new Offer[](count);
        uint256 found = 0;

        for (uint256 i = _startId; i <= _endId; i++) {
            if (offers[i].offeror == _offeror) {
                _offers[found] = offers[i];
                found++;
            }
        }

        // Resize array to actual found count
        assembly {
            mstore(_offers, found)
        }

        return _offers;
    }

    function getAllValidOffers(uint256 _startId, uint256 _endId) external view returns (Offer[] memory) {
        require(_endId >= _startId, "Marketplace: invalid range.");
        uint256 count = _endId - _startId + 1;
        Offer[] memory _offers = new Offer[](count);
        uint256 found = 0;

        for (uint256 i = _startId; i <= _endId; i++) {
            if (offers[i].status == OffersStatus.CREATED && offers[i].expirationTimestamp > block.timestamp) {
                _offers[found] = offers[i];
                found++;
            }
        }

        // Resize array to actual found count
        assembly {
            mstore(_offers, found)
        }

        return _offers;
    }

    // Helper functions
    function _getTokenType(address _assetContract) internal view returns (OffersTokenType) {
        try IERC165(_assetContract).supportsInterface(type(IERC721).interfaceId) returns (bool supported) {
            if (supported) return OffersTokenType.ERC721;
        } catch {}

        try IERC165(_assetContract).supportsInterface(type(IERC1155).interfaceId) returns (bool supported) {
            if (supported) return OffersTokenType.ERC1155;
        } catch {}

        revert("Marketplace: unsupported token type.");
    }

    function _getNextOfferId() internal returns (uint256) {
        return nextOfferId++;
    }

    function _validateNewOffer(OfferParams memory _params, OffersTokenType _tokenType) internal view {
        require(_params.quantity > 0, "Marketplace: quantity must be greater than 0.");
        require(_params.totalPrice > 0, "Marketplace: total price must be greater than 0.");
        require(_params.expirationTimestamp > block.timestamp, "Marketplace: expiration must be in the future.");

        if (_tokenType == OffersTokenType.ERC721) {
            require(_params.quantity == 1, "Marketplace: ERC721 offers can only have quantity 1.");
        }
    }

    function _validateERC20BalAndAllowance(address _offeror, address _currency, uint256 _amount) internal view returns (bool) {
        if (_currency == CurrencyTransferLib.NATIVE_TOKEN) {
            return _offeror.balance >= _amount;
        } else {
            return IERC20(_currency).balanceOf(_offeror) >= _amount &&
                   IERC20(_currency).allowance(_offeror, address(this)) >= _amount;
        }
    }

    function _validateOwnershipAndApproval(
        address _tokenOwner,
        address _assetContract,
        uint256 _tokenId,
        uint256 _quantity,
        OffersTokenType _tokenType
    ) internal view {
        if (_tokenType == OffersTokenType.ERC721) {
            require(IERC721(_assetContract).ownerOf(_tokenId) == _tokenOwner, "Marketplace: not token owner.");
            require(
                IERC721(_assetContract).isApprovedForAll(_tokenOwner, address(this)) ||
                IERC721(_assetContract).getApproved(_tokenId) == address(this),
                "Marketplace: not approved."
            );
        } else if (_tokenType == OffersTokenType.ERC1155) {
            require(IERC1155(_assetContract).balanceOf(_tokenOwner, _tokenId) >= _quantity, "Marketplace: insufficient balance.");
            require(IERC1155(_assetContract).isApprovedForAll(_tokenOwner, address(this)), "Marketplace: not approved.");
        }
    }

    function _payout(
        address _offeror,
        address _tokenOwner,
        address _currency,
        uint256 _amount,
        Offer memory _offer
    ) internal {
        if (_currency == CurrencyTransferLib.NATIVE_TOKEN) {
            // For native token offers (HYPE on HyperEVM), the payment was already sent with makeOffer
            // We just need to transfer it from the contract to the token owner
            CurrencyTransferLib.safeTransferNativeToken(_tokenOwner, _amount);
        } else {
            // For ERC20 tokens, transfer from offeror to token owner
            CurrencyTransferLib.safeTransferERC20(_currency, _offeror, _tokenOwner, _amount);
        }
    }

    function _transferOfferTokens(
        address _tokenOwner,
        address _offeror,
        uint256 _quantity,
        Offer memory _offer
    ) internal {
        if (_offer.tokenType == OffersTokenType.ERC721) {
            IERC721(_offer.assetContract).safeTransferFrom(_tokenOwner, _offeror, _offer.tokenId);
        } else if (_offer.tokenType == OffersTokenType.ERC1155) {
            IERC1155(_offer.assetContract).safeTransferFrom(_tokenOwner, _offeror, _offer.tokenId, _quantity, "");
        }
    }

    function _offersStorage() internal view returns (address) {
        return address(this);
    }
}
