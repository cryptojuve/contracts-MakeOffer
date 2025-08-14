# 🚀 Déploiement ERC721Collection avec Forge

Ce guide explique comment déployer le contrat `ERC721Collection` en utilisant Forge pour la compilation et un script JavaScript pour le déploiement.

## 📋 Prérequis

- [Forge](https://book.getfoundry.sh/getting-started/installation) installé
- [Node.js](https://nodejs.org/) (version 16+)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Clé privée d'un wallet avec des fonds sur le réseau cible

## 🏗️ Structure du projet

```
contracts-MakeOffer/
├── contracts/
│   └── ERC721Collection.sol          # Contrat principal
├── script/
│   └── DeployERC721.s.sol            # Script Forge (optionnel)
├── artifacts_forge/                   # Artifacts compilés par Forge
├── deploy-erc721-collection.js        # Script de déploiement JavaScript
├── foundry.toml                       # Configuration Forge
└── .env                               # Variables d'environnement
```

## ⚙️ Configuration

### 1. Variables d'environnement

Créez un fichier `.env` basé sur `env.example` :

```bash
# Clé privée du déployeur
PRIVATE_KEY=your_private_key_here

# URLs RPC pour les différents réseaux
HYPEREVM_RPC_URL=https://999.rpc.thirdweb.com
HYPEREVM_TESTNET_RPC_URL=https://testnet-rpc.hyperevm.com
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Clé API Etherscan pour la vérification
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Réseau de déploiement
NETWORK=hyperevm-testnet
```

### 2. Installation des dépendances

```bash
npm install
```

## 🔨 Compilation avec Forge

### 1. Compiler le contrat

```bash
forge build
```

Cela génère les artifacts dans le dossier `artifacts_forge/`.

### 2. Vérifier la compilation

```bash
forge build --sizes
```

## 🚀 Déploiement

### Option 1: Script JavaScript (Recommandé)

Le script `deploy-erc721-collection.js` utilise les artifacts Forge et ethers.js pour le déploiement.

#### 1. Charger les variables d'environnement

```bash
export PRIVATE_KEY=your_private_key_here
export HYPEREVM_RPC_URL=https://999.rpc.thirdweb.com
```

#### 2. Lancer le déploiement

```bash
node deploy-erc721-collection.js
```

#### 3. Suivre le processus

Le script affiche :
- ✅ Vérification de la connexion réseau
- ✅ Vérification du solde
- ✅ Chargement des artifacts
- 🚀 Déploiement du contrat
- ✅ Vérification des fonctions
- 📋 Résumé final

### Option 2: Script Forge (Avancé)

Si vous préférez utiliser uniquement Forge :

```bash
# Charger les variables d'environnement
source .env

# Déployer avec Forge
forge script script/DeployERC721.s.sol:DeployERC721 \
    --rpc-url $HYPEREVM_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
```

## 📊 Paramètres de la collection

La collection `testnetscratch` est configurée avec :

- **Nom** : testnetscratch
- **Symbole** : TNS
- **Supply maximale** : 10,000 NFTs
- **Prix de mint** : 0.01 HYPE (token natif HyperEVM)
- **Limite par wallet** : 10 NFTs
- **Limite par transaction** : 5 NFTs

## 🔐 Rôles et permissions

Le contrat utilise un système de rôles OpenZeppelin :

- **DEFAULT_ADMIN_ROLE** : Gestion complète du contrat
- **MINTER_ROLE** : Peut mint de nouveaux tokens
- **BURNER_ROLE** : Peut brûler des tokens
- **METADATA_ROLE** : Peut modifier les métadonnées

Le déployeur reçoit automatiquement tous ces rôles.

## 🧪 Tests et vérification

### 1. Vérifier le déploiement

```bash
# Vérifier que le contrat a du code
cast code <ADRESSE_CONTRAT> --rpc-url $HYPEREVM_RPC_URL
```

### 2. Tester les fonctions

```bash
# Vérifier les rôles
cast call <ADRESSE_CONTRAT> "DEFAULT_ADMIN_ROLE()" --rpc-url $HYPEREVM_RPC_URL

# Vérifier les paramètres
cast call <ADRESSE_CONTRAT> "maxSupply()" --rpc-url $HYPEREVM_RPC_URL
cast call <ADRESSE_CONTRAT> "mintPrice()" --rpc-url $HYPEREVM_RPC_URL
```

## 🚨 Dépannage

### Erreurs communes

1. **Solde insuffisant**
   ```
   ❌ Solde insuffisant pour le déploiement
   ```
   Solution : Ajouter des fonds au wallet déployeur

2. **Artifacts manquants**
   ```
   ❌ ENOENT: no such file or directory
   ```
   Solution : Exécuter `forge build` d'abord

3. **Clé privée manquante**
   ```
   ❌ PRIVATE_KEY non définie dans l'environnement
   ```
   Solution : Définir la variable `PRIVATE_KEY`

### Logs détaillés

Pour plus de détails, ajoutez des logs :

```bash
DEBUG=* node deploy-erc721-collection.js
```

## 📚 Prochaines étapes

Après le déploiement réussi :

1. **Vérifier le contrat** sur l'explorer du réseau
2. **Configurer l'URI de base** pour les métadonnées
3. **Préparer les métadonnées** des NFTs
4. **Tester le mint** de quelques NFTs
5. **Lancer la vente publique**

## 🔗 Liens utiles

- [Documentation Forge](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Ethers.js](https://docs.ethers.org/)
- [ERC-721 Standard](https://eips.ethereum.org/EIPS/eip-721)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE.md` pour plus de détails.
