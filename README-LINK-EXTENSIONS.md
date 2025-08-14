# 🔗 Liaison des Extensions à la Marketplace

## 📖 Description

Ce script permet de lier automatiquement les contrats `DirectListingsExtension` et `Offers` à la `MarketplaceV3` après leur déploiement.

## 🎯 Objectif

Après avoir déployé les 3 smart contracts séparément, ce script :
1. **Vérifie** que tous les contrats sont déployés et accessibles
2. **Enregistre** les extensions auprès de la marketplace
3. **Vérifie** que les liaisons sont correctes
4. **Affiche** un résumé de toutes les extensions

## 📋 Prérequis

### ✅ Contrats Déployés
- **MarketplaceV3** : Contrat principal déjà déployé
- **DirectListingsExtension** : Extension des listings déjà déployée
- **Offers** : Extension des offres déjà déployée

### 🔑 Permissions
- **EXTENSION_ROLE** sur la MarketplaceV3
- **Clé privée** avec des fonds HYPE pour les transactions

### 📦 Dépendances
```bash
npm install ethers
```

## 🚀 Utilisation

### 1️⃣ **Configuration des Variables d'Environnement**

```bash
# Clé privée du déployeur
export PRIVATE_KEY="votre_clé_privée"

# Adresses des contrats déployés
export MARKETPLACE_ADDRESS="0x..."
export DIRECTLISTINGS_ADDRESS="0x..."
export OFFERS_ADDRESS="0x..."

# RPC HyperEVM (optionnel, défaut: https://999.rpc.thirdweb.com)
export HYPEREVM_RPC_URL="https://999.rpc.thirdweb.com"

# Confirmation automatique (optionnel)
export CONFIRM="oui"
```

### 2️⃣ **Exécution du Script**

```bash
# Mode interactif (demande les adresses)
node link-extensions.js

# Mode non-interactif (utilise les variables d'environnement)
NODE_ENV=production node link-extensions.js
```

### 3️⃣ **Mode Interactif**

Si vous n'avez pas configuré les variables d'environnement, le script vous demandera :

```
📝 Configuration des Adresses de Contrats:
💡 Entrez les adresses des contrats déjà déployés
Entrez l'adresse de MarketplaceV3: 0x...
Entrez l'adresse de DirectListingsExtension: 0x...
Entrez l'adresse de Offers: 0x...
```

## 📊 Fonctionnement du Script

### 🔍 **Étapes de Vérification**

1. **Connexion** : Vérifie la connexion à HyperEVM
2. **Solde** : Contrôle que le wallet a des fonds HYPE
3. **Contrats** : Vérifie que tous les contrats sont accessibles
4. **Permissions** : Confirme le rôle EXTENSION_ROLE
5. **Extensions existantes** : Vérifie si déjà enregistrées

### 🔗 **Processus de Liaison**

1. **Enregistrement DirectListingsExtension**
   - ID: `keccak256("DIRECT_LISTINGS")`
   - Nom: "Direct Listings Extension"

2. **Enregistrement Offers**
   - ID: `keccak256("OFFERS")`
   - Nom: "Offers Extension"

3. **Vérification des liaisons**
   - Contrôle que les extensions sont bien enregistrées
   - Affiche le statut de chaque extension

## 📝 Exemple de Sortie

```
🔗 Liaison des Extensions à la Marketplace...
📱 Déployeur: 0x3E5064AA3e0A17ba1C439AD532A73C6e0D01B6d0
🔗 RPC: https://999.rpc.thirdweb.com
🌐 Réseau: HyperEVM
🔗 Chain ID: 999
💰 Solde: 9.4851 HYPE

📋 Chargement des ABIs...
✅ MarketplaceV3 vérifié
✅ DirectListingsExtension vérifié
✅ Offers vérifié
✅ Permissions vérifiées (EXTENSION_ROLE)

🏪 Enregistrement de DirectListingsExtension...
⏳ Transaction envoyée: 0x...
✅ DirectListingsExtension enregistrée avec succès

🎯 Enregistrement de Offers...
⏳ Transaction envoyée: 0x...
✅ Offers enregistrée avec succès

🔍 Vérification des liaisons...
✅ DirectListingsExtension vérifiée:
   Adresse: 0x...
   Activée: true
   Nom: Direct Listings Extension

✅ Offers vérifiée:
   Adresse: 0x...
   Activée: true
   Nom: Offers Extension

🎉 Liaison des extensions terminée avec succès !
```

## ⚙️ Configuration Avancée

### 🔧 **Fichier de Configuration**

Vous pouvez modifier `link-extensions.config.js` pour :

- **Changer les IDs** des extensions
- **Modifier les noms** affichés
- **Ajuster les paramètres** de transaction
- **Configurer la verbosité** des logs

### 🌐 **Variables d'Environnement Supplémentaires**

```bash
# Mode production (non-interactif)
export NODE_ENV=production

# Logs détaillés
export VERBOSE=true

# Confirmation automatique
export CONFIRM=oui
```

## 🚨 Gestion des Erreurs

### ❌ **Erreurs Communes**

1. **PRIVATE_KEY non définie**
   ```bash
   export PRIVATE_KEY="votre_clé_privée"
   ```

2. **Solde insuffisant**
   - Assurez-vous d'avoir des fonds HYPE sur HyperEVM

3. **Permissions insuffisantes**
   - Vérifiez que vous avez le rôle EXTENSION_ROLE

4. **Contrats non déployés**
   - Déployez d'abord tous les contrats

### 🔍 **Débogage**

```bash
# Mode verbose
VERBOSE=true node link-extensions.js

# Vérification de la configuration
node -e "import('./link-extensions.config.js').then(c => c.displayConfig())"
```

## 📚 Ressources

### 🔗 **Liens Utiles**
- **Script principal** : `link-extensions.js`
- **Configuration** : `link-extensions.config.js`
- **Documentation complète** : `DOCUMENTATION-SMART-CONTRACTS.md`
- **Résumé technique** : `RESUME-TECHNIQUE-CONTRATS.md`

### 📖 **Documentation Associée**
- **Déploiement** : `deploy-optimized.js`
- **Test de connexion** : `test-connection.js`
- **Troubleshooting** : `TROUBLESHOOTING-GAS-LIMIT.md`

## 🎯 **Prochaines Étapes**

Après la liaison des extensions :

1. **Tester les fonctionnalités** :
   - Créer un listing via DirectListingsExtension
   - Créer une offre via Offers

2. **Vérifier l'intégration** :
   - Les extensions apparaissent dans la marketplace
   - Les fonctions sont accessibles

3. **Déployer en production** :
   - Vérifier les contrats sur l'explorateur
   - Tester avec des vrais NFTs

---

*Script de liaison des extensions - Version 1.0.0*
