// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "lib/creator-token-standards/lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "lib/creator-token-standards/lib/openzeppelin-contracts/contracts/utils/Context.sol";

contract ERC721NativeOffers is Context {
    struct Offer {
        uint256 offerId;
        address assetContract;
        uint256 tokenId;
        address currency;
        uint256 totalPrice;
        uint256 expirationTimestamp;
        address offeror;
        bool active;
    }

    mapping(uint256 => Offer) public offers;
    uint256 public nextOfferId;

    event NewOffer(address indexed offeror, uint256 indexed offerId, address indexed assetContract, Offer offer);
    event OfferAccepted(address indexed seller, uint256 indexed offerId, uint256 totalPrice);
    event OfferCancelled(address indexed offeror, uint256 indexed offerId);

    // --- MAKE OFFER (NATIF UNIQUEMENT) ---
    function makeOffer(address assetContract, uint256 tokenId, uint256 expirationTimestamp)
        external
        payable
        returns (uint256 offerId)
    {
        require(msg.value > 0, "Montant natif requis");
        require(expirationTimestamp > block.timestamp, "Expiration invalide");

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            offerId: offerId,
            assetContract: assetContract,
            tokenId: tokenId,
            currency: address(0), // natif uniquement
            totalPrice: msg.value,
            expirationTimestamp: expirationTimestamp,
            offeror: _msgSender(),
            active: true
        });

        emit NewOffer(_msgSender(), offerId, assetContract, offers[offerId]);
    }

    // --- ACCEPT OFFER ---
    function acceptOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        require(offer.active, "Offre inactive");
        require(block.timestamp <= offer.expirationTimestamp, "Offre expiree");
        require(IERC721(offer.assetContract).ownerOf(offer.tokenId) == _msgSender(), "Pas proprietaire");
        require(IERC721(offer.assetContract).isApprovedForAll(_msgSender(), address(this)), "Marketplace non approuvee");

        // Transfert NFT
        IERC721(offer.assetContract).safeTransferFrom(_msgSender(), offer.offeror, offer.tokenId);

        // Paiement natif au vendeur
        (bool sent,) = _msgSender().call{value: offer.totalPrice}("");
        require(sent, "Transfert natif echoue");

        offer.active = false;
        emit OfferAccepted(_msgSender(), offerId, offer.totalPrice);
    }

    // --- CANCEL OFFER ---
    function cancelOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        require(offer.active, "Offre inactive");
        require(offer.offeror == _msgSender(), "Pas l'initiateur");

        // Refund natif à l'offeror
        (bool sent,) = offer.offeror.call{value: offer.totalPrice}("");
        require(sent, "Refund echoue");

        offer.active = false;
        emit OfferCancelled(_msgSender(), offerId);
    }

    // --- Fallback pour recevoir du natif ---
    receive() external payable {}
}
