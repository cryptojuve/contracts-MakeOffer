# 📋 Résumé Technique des Smart Contracts

## 🎯 Vue d'Ensemble Rapide

| Contrat | Rôle | Héritage | Fonctionnalité Principale |
|---------|------|----------|---------------------------|
| **MarketplaceV3** | Hub Central | AccessControl, ReentrancyGuard, Pausable | Gestion des extensions et frais |
| **DirectListingsExtension** | Ventes Directes | AccessControl, ReentrancyGuard, Pausable | Listings et achats de NFTs |
| **Offers** | Gestion des Offres | AccessControl, ReentrancyGuard, Pausable | Offres d'achat de NFTs |

---

## 🏢 MarketplaceV3 - Contrat Principal

### 🔑 Rôles
- `DEFAULT_ADMIN_ROLE` : Administration complète
- `EXTENSION_ROLE` : Gestion des extensions
- `FEE_MANAGER_ROLE` : Configuration des frais
- `ROYALTY_MANAGER_ROLE` : Gestion des royalties

### ⚙️ Fonctions Clés
```solidity
// Gestion des extensions
addExtension(bytes32 extensionId, address extension, string name)
removeExtension(bytes32 extensionId)
updateExtension(bytes32 extensionId, address extension, string name)

// Configuration des frais
setPlatformFee(uint16 bps, address recipient) // Max 10% (1000 bps)

// Gestion des tokens
receive() external payable // Support HYPE natif
withdrawNativeTokens() // Retrait d'urgence
withdrawERC20Tokens(address token, uint256 amount)
```

---

## 🏪 DirectListingsExtension - Ventes Directes

### 🔑 Rôles
- `DEFAULT_ADMIN_ROLE` : Administration
- `LISTER_ROLE` : Création de listings
- `ASSET_ROLE` : Contrôle des assets

### ⚙️ Fonctions Clés
```solidity
// Création de listing
createListing(
    address assetContract, uint256 tokenId, uint256 quantity,
    address currency, uint256 pricePerToken,
    uint256 startTimestamp, uint256 endTimestamp,
    bool reserved, address reservedBuyer
) external returns (uint256 listingId)

// Achat de listing
buyListing(uint256 listingId, uint256 quantity) external payable

// Gestion
updateListing(uint256 listingId, ...)
cancelListing(uint256 listingId)
```

### 💰 Support des Paiements
- **HYPE natif** : `msg.value` pour paiements directs
- **ERC-20** : Transferts via `transferFrom`
- **Remboursement** : Excédent automatiquement retourné

---

## 🎯 Offers - Gestion des Offres

### 🔑 Rôles
- `DEFAULT_ADMIN_ROLE` : Administration
- `OFFEROR_ROLE` : Création d'offres
- `MANAGER_ROLE` : Gestion administrative

### ⚙️ Fonctions Clés
```solidity
// Création d'offre
createOffer(
    address assetContract, uint256 tokenId, uint256 quantity,
    address currency, uint256 pricePerToken,
    uint256 startTimestamp, uint256 endTimestamp
) external returns (uint256 offerId)

// Acceptation d'offre
acceptOffer(uint256 offerId, uint256 quantity) external payable

// Gestion
cancelOffer(uint256 offerId)
```

### 💰 Mécanisme de Paiement
- **Pré-approbation** : L'offreur approuve le transfert
- **Acceptation** : Le vendeur accepte et reçoit le paiement
- **Support multi-tokens** : ERC-20 et HYPE natif

---

## 🔒 Sécurité et Protection

### 🛡️ Mécanismes Implémentés
- **ReentrancyGuard** : Protection contre la réentrance
- **Pausable** : Pause d'urgence
- **AccessControl** : Gestion des rôles et permissions
- **Validation** : Vérification de tous les paramètres

### 🚨 Fonctions d'Urgence
- **Pause** : `pause()` par l'admin
- **Retraits** : `withdrawNativeTokens()` et `withdrawERC20Tokens()`
- **Annulation** : Possibilité d'annuler listings et offres

---

## 🌐 Support des Standards

### 📱 Tokens Supportés
- **ERC-721** : NFTs uniques
- **ERC-1155** : NFTs multiples
- **ERC-20** : Tokens fongibles
- **HYPE** : Token natif HyperEVM

### 🔗 Réseaux Compatibles
- **HyperEVM** : Réseau principal (Chain ID 999)
- **EVM** : Compatible avec tous les réseaux EVM
- **Interopérabilité** : Standards EIP respectés

---

## 📊 Architecture des Données

### 🏗️ Structures Principales
```solidity
// MarketplaceV3
struct Extension {
    address extension;
    bool enabled;
    string name;
}

struct PlatformFee {
    uint16 bps;
    address recipient;
}

// DirectListingsExtension
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

// Offers
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
```

---

## 🚀 Déploiement et Configuration

### 📋 Ordre de Déploiement
1. **MarketplaceV3** (contrat principal)
2. **DirectListingsExtension** (extension listings)
3. **Offers** (extension offres)
4. **Enregistrement** des extensions

### ⚙️ Paramètres de Configuration
```solidity
// MarketplaceV3
constructor(
    address admin,           // Administrateur principal
    uint16 platformFeeBps,  // Frais plateforme (ex: 250 = 2.5%)
    address feeRecipient,    // Destinataire des frais
    address royaltyEngine,   // Moteur de royalties
    address nativeWrapper    // Wrapper token natif
)

// DirectListingsExtension
constructor(
    address nativeTokenWrapper,  // Wrapper token natif
    address admin                // Administrateur
)

// Offers
constructor(
    address admin  // Administrateur
)
```

---

## 📈 Évolutivité et Extensions

### 🔌 Système d'Extensions
- **Modulaire** : Ajout/suppression d'extensions
- **Flexible** : Chaque extension peut avoir ses propres rôles
- **Sécurisé** : Contrôle d'accès par extension

### 🚀 Possibilités d'Extension
- **Auction** : Système d'enchères
- **Staking** : Mise en jeu de tokens
- **Governance** : Système de gouvernance
- **Cross-chain** : Ponts inter-chaînes

---

*Résumé technique - Version 1.0.0 - Projet Marketplace OpenZeppelin*
