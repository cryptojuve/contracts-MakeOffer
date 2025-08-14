# 🚀 Marketplace avec Offres - Contrats OpenZeppelin

Un marketplace décentralisé avec fonctionnalité d'offres, construit avec des contrats intelligents Solidity utilisant OpenZeppelin.

## 🏗️ Architecture

### Contrats Principaux
- **`MarketplaceV3OpenZeppelin`** : Contrat principal du marketplace avec gestion des extensions
- **`DirectListingsExtensionOpenZeppelin`** : Extension pour les listings directs
- **`OffersOpenZeppelin`** : Extension pour la gestion des offres

### Fonctionnalités
- ✅ **Modulaire** : Architecture extensible avec système d'extensions
- ✅ **Sécurisé** : Utilise OpenZeppelin pour la sécurité
- ✅ **Compatible HYPE** : Support du token natif HyperEVM
- ✅ **Gestion des rôles** : Contrôle d'accès basé sur les rôles
- ✅ **Frais de plateforme** : Système de frais configurable
- ✅ **Royalties** : Support des royalties pour les créateurs

## 🚀 Déploiement

### Prérequis
- Node.js 18+
- Foundry
- Clé privée avec des fonds HYPE

### Installation
```bash
npm install
```

### Configuration
Créez un fichier `.env` :
```env
PRIVATE_KEY=votre_clé_privée
HYPEREVM_RPC_URL=https://999.rpc.thirdweb.com
```

### Déploiement
```bash
# 1. Déployer les contrats
npm run deploy

# 2. Lier les extensions à la marketplace
npm run link-extensions
```

### Test de Connexion
```bash
npm run test-connection
```

## 🔧 Développement

### Compilation
```bash
forge build
```

### Tests
```bash
forge test
```

## 🌐 Réseau
- **Chain ID** : 999 (HyperEVM)
- **Token Natif** : HYPE
- **RPC** : https://999.rpc.thirdweb.com

## 📚 Documentation
- **📖 Documentation Complète** : `DOCUMENTATION-SMART-CONTRACTS.md` - Guide détaillé des 3 smart contracts
- **📋 Résumé Technique** : `RESUME-TECHNIQUE-CONTRATS.md` - Vue d'ensemble rapide et technique
- **🚨 Troubleshooting Gas Limit** : `TROUBLESHOOTING-GAS-LIMIT.md` - Guide de dépannage
- **🔄 Migration OpenZeppelin** : Documentation complète de la migration

## 🔒 Sécurité
- Contrats audités par OpenZeppelin
- Protection contre les attaques de réentrance
- Contrôle d'accès basé sur les rôles
- Fonctions pausables pour les urgences

## 📄 Licence
MIT License
