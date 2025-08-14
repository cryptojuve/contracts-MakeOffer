# 📚 Documentation des Smart Contracts OpenZeppelin

## 🏗️ Vue d'Ensemble

Ce projet implémente un marketplace décentralisé complet avec fonctionnalité d'offres, construit avec des smart contracts Solidity utilisant la bibliothèque OpenZeppelin pour la sécurité et la fiabilité.

### 🎯 Objectifs
- **Sécurité** : Utilisation des contrats audités d'OpenZeppelin
- **Modularité** : Architecture extensible avec système d'extensions
- **Compatibilité HYPE** : Support du token natif HyperEVM (chain ID 999)
- **Flexibilité** : Support des tokens ERC-20, ERC-721 et ERC-1155

---

## 📋 Table des Matières

1. [DirectListingsExtension](#directlistingsextension)
2. [Offers](#offers)
3. [MarketplaceV3](#marketplacev3)
4. [Architecture Globale](#architecture-globale)
5. [Sécurité](#sécurité)
6. [Déploiement](#déploiement)

---

## 🏪 DirectListingsExtension

### 📖 Description
Le contrat `DirectListingsExtension` gère la création et la gestion des listings directs de NFTs. Il permet aux utilisateurs de lister leurs tokens pour la vente directe.

### 🔧 Fonctionnalités Principales

#### **Gestion des Rôles**
- `LISTER_ROLE` : Peut créer et gérer des listings
- `ASSET_ROLE` : Contrôle quels assets peuvent être listés
- `DEFAULT_ADMIN_ROLE` : Administration complète du contrat

#### **Création de Listing**
```solidity
function createListing(
    address _assetContract,    // Adresse du contrat NFT
    uint256 _tokenId,         // ID du token
    uint256 _quantity,        // Quantité disponible
    address _currency,         // Token de paiement (0x0 pour HYPE)
    uint256 _pricePerToken,   // Prix par token
    uint256 _startTimestamp,  // Début de la vente
    uint256 _endTimestamp,    // Fin de la vente
    bool _reserved,           // Vente réservée ?
    address _reservedBuyer    // Acheteur réservé
) external returns (uint256 listingId)
```

#### **Achat de Listing**
```solidity
function buyListing(
    uint256 _listingId,       // ID du listing
    uint256 _quantity         // Quantité à acheter
) external payable
```

#### **Gestion des Listings**
- **Mise à jour** : Modification des paramètres avant le début
- **Annulation** : Annulation par le lister
- **Finalisation** : Automatique quand la quantité est épuisée

### 💰 Support des Paiements
- **HYPE natif** : `msg.value` pour les paiements directs
- **Tokens ERC-20** : Transferts via `transferFrom`
- **Remboursement automatique** : Excédent de paiement retourné

### 🔒 Sécurité
- **ReentrancyGuard** : Protection contre les attaques de réentrance
- **Pausable** : Possibilité de pause d'urgence
- **Vérifications de propriété** : Seuls les propriétaires peuvent vendre

---

## 🎯 Offers

### 📖 Description
Le contrat `Offers` permet aux utilisateurs de faire des offres sur des NFTs. Les vendeurs peuvent accepter ces offres pour vendre leurs tokens.

### 🔧 Fonctionnalités Principales

#### **Gestion des Rôles**
- `OFFEROR_ROLE` : Peut créer des offres
- `MANAGER_ROLE` : Gestion administrative
- `DEFAULT_ADMIN_ROLE` : Administration complète

#### **Création d'Offre**
```solidity
function createOffer(
    address _assetContract,    // Adresse du contrat NFT
    uint256 _tokenId,         // ID du token
    uint256 _quantity,        // Quantité désirée
    address _currency,         // Token de paiement
    uint256 _pricePerToken,   // Prix par token
    uint256 _startTimestamp,  // Début de validité
    uint256 _endTimestamp     // Fin de validité
) external returns (uint256 offerId)
```

#### **Acceptation d'Offre**
```solidity
function acceptOffer(
    uint256 _offerId,         // ID de l'offre
    uint256 _quantity         // Quantité à vendre
) external payable
```

#### **Gestion des Offres**
- **Annulation** : Par l'offreur avant acceptation
- **Acceptation partielle** : Possibilité d'accepter une partie de l'offre
- **Finalisation automatique** : Quand la quantité totale est acceptée

### 💰 Mécanisme de Paiement
- **Pré-approbation** : L'offreur doit approuver le transfert avant acceptation
- **Transfert automatique** : Paiement transféré lors de l'acceptation
- **Support multi-tokens** : ERC-20 et HYPE natif

### 🔒 Sécurité
- **Vérification de propriété** : Seuls les propriétaires peuvent accepter
- **Vérification de solde** : Contrôle des quantités disponibles
- **Protection contre la réentrance** : `nonReentrant` sur les fonctions critiques

---

## 🏢 MarketplaceV3

### 📖 Description
Le contrat `MarketplaceV3` est le hub central qui gère toutes les extensions et coordonne le fonctionnement global du marketplace.

### 🔧 Fonctionnalités Principales

#### **Gestion des Rôles**
- `EXTENSION_ROLE` : Peut ajouter/supprimer des extensions
- `FEE_MANAGER_ROLE` : Gère les frais de plateforme
- `ROYALTY_MANAGER_ROLE` : Gère le moteur de royalties
- `DEFAULT_ADMIN_ROLE` : Administration complète

#### **Système d'Extensions**
```solidity
struct Extension {
    address extension;    // Adresse du contrat extension
    bool enabled;         // Extension activée ?
    string name;          // Nom de l'extension
}
```

#### **Gestion des Extensions**
- **Ajout** : `addExtension(extensionId, address, name)`
- **Suppression** : `removeExtension(extensionId)`
- **Mise à jour** : `updateExtension(extensionId, address, name)`

#### **Frais de Plateforme**
```solidity
struct PlatformFee {
    uint16 bps;          // Frais en basis points (1% = 100)
    address recipient;    // Destinataire des frais
}
```

#### **Configuration des Frais**
- **Limite maximale** : 10% (1000 bps)
- **Modification** : Via `setPlatformFee(bps, recipient)`
- **Flexibilité** : Différents destinataires possibles

### 💰 Gestion des Tokens
- **Réception HYPE** : Fonction `receive()` payable
- **Retrait d'urgence** : `withdrawNativeTokens()` et `withdrawERC20Tokens()`
- **Support multi-tokens** : Gestion des ERC-20 et HYPE natif

### 🔒 Sécurité
- **Contrôle d'accès** : Rôles séparés pour chaque fonction
- **Validation des adresses** : Vérification des adresses non-nulles
- **Gestion des erreurs** : Events pour toutes les opérations critiques

---

## 🏛️ Architecture Globale

### 📊 Schéma d'Architecture
```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   MarketplaceV3 │    │ DirectListingsExt.   │    │     Offers      │
│   (Hub Central) │◄──►│   (Listings)         │    │   (Offres)      │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                       │                           │
         │                       │                           │
         ▼                       ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  Gestion des    │    │   Support HYPE       │    │  Support ERC20  │
│   Extensions    │    │   (Token Natif)      │    │   (Tokens)      │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

### 🔗 Interactions entre Contrats

#### **MarketplaceV3 ↔ Extensions**
- **Enregistrement** : Les extensions s'enregistrent auprès du marketplace
- **Communication** : Le marketplace peut interroger les extensions
- **Gestion** : Ajout, suppression et mise à jour des extensions

#### **Extensions ↔ Tokens**
- **DirectListings** : Gère les ventes directes de NFTs
- **Offers** : Gère les offres d'achat de NFTs
- **Support multi-standards** : ERC-721, ERC-1155, ERC-20

### 🌐 Support des Réseaux
- **HyperEVM** : Réseau principal (Chain ID 999)
- **Token natif** : HYPE pour les paiements
- **Interopérabilité** : Compatible avec d'autres réseaux EVM

---

## 🔒 Sécurité

### 🛡️ Mécanismes de Protection

#### **Contrôle d'Accès (RBAC)**
- **Rôles séparés** : Chaque fonction a son rôle dédié
- **Héritage de rôles** : Hiérarchie claire des permissions
- **Administration centralisée** : `DEFAULT_ADMIN_ROLE` pour la gestion

#### **Protection contre les Attaques**
- **ReentrancyGuard** : Protection contre la réentrance
- **Pausable** : Pause d'urgence en cas de problème
- **Validation des entrées** : Vérification de tous les paramètres

#### **Gestion des Fonds**
- **Transferts sécurisés** : Utilisation d'OpenZeppelin `Address`
- **Remboursements automatiques** : Excédent de paiement retourné
- **Retraits d'urgence** : Fonctions d'administration pour récupérer les fonds

### 🔍 Audit et Vérification
- **OpenZeppelin** : Contrats audités et testés
- **Standards EIP** : Conformité aux standards Ethereum
- **Tests complets** : Couverture de tous les cas d'usage

---

## 🚀 Déploiement

### 📋 Prérequis
- **Foundry** : Framework de développement Solidity
- **Node.js** : Pour les scripts de déploiement
- **Clé privée** : Avec des fonds HYPE sur HyperEVM

### ⚙️ Configuration
```bash
# Installation des dépendances
npm install

# Compilation des contrats
forge build

# Test des contrats
forge test
```

### 🔧 Variables d'Environnement
```env
# Clé privée du déployeur
PRIVATE_KEY=votre_clé_privée

# URL RPC HyperEVM
HYPEREVM_RPC_URL=https://999.rpc.thirdweb.com

# Configuration optionnelle
PLATFORM_FEE_BPS=250
PLATFORM_FEE_RECIPIENT=0x...
NATIVE_TOKEN_WRAPPER=0x...
```

### 📜 Ordre de Déploiement
1. **MarketplaceV3** : Contrat principal
2. **DirectListingsExtension** : Extension des listings
3. **Offers** : Extension des offres
4. **Enregistrement** : Ajout des extensions au marketplace

### 🧪 Tests et Vérification
```bash
# Test de connexion
npm run test-connection

# Déploiement complet
npm run deploy

# Vérification des contrats
forge verify-contract --chain-id 999
```

---

## 📚 Ressources Additionnelles

### 🔗 Liens Utiles
- **OpenZeppelin** : [docs.openzeppelin.com](https://docs.openzeppelin.com/)
- **HyperEVM** : [hyperevm.com](https://hyperevm.com/)
- **Foundry** : [getfoundry.sh](https://getfoundry.sh/)

### 📖 Documentation Technique
- **Standards EIP** : ERC-20, ERC-721, ERC-1155
- **Sécurité** : Bonnes pratiques de développement
- **Tests** : Stratégies de test des smart contracts

### 🆘 Support et Dépannage
- **Troubleshooting Gas Limit** : `TROUBLESHOOTING-GAS-LIMIT.md`
- **Logs de compilation** : `forge build --verbose`
- **Tests de réseau** : `test-connection.js`

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE.md` pour plus de détails.

---

*Documentation générée pour le projet Marketplace OpenZeppelin - Version 1.0.0*
