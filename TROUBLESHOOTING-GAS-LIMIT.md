# 🚨 Résolution des Problèmes de Gas Limit

## ❌ Erreur Rencontrée

```
❌ Deployment failed: Error: could not coalesce error (error={ "code": -32603, "message": "exceeds block gas limit" })
```

## 🔍 Diagnostic

### **Problème Identifié**
Le contrat `MarketplaceV3OpenZeppelin` dépasse la limite de gas par bloc sur HyperEVM.

### **Causes Possibles**
1. **Contrat trop volumineux** : Le contrat OpenZeppelin est plus gros que l'original Thirdweb
2. **Limite de gas HyperEVM** : Le réseau peut avoir une limite de gas plus restrictive
3. **Optimisation insuffisante** : Le bytecode n'est pas optimisé pour la taille

## 🔧 Solutions

### **Solution 1 : Vérification de la Configuration HyperEVM**

#### **Étape 1 : Identifier l'URL RPC Correcte**
```bash
# HyperEVM peut utiliser différentes URLs selon la configuration
# Essayer ces URLs courantes :
HYPEREVM_RPC_URL=https://hyperevm-rpc.example.com
HYPEREVM_RPC_URL=https://rpc.hyperevm.network
HYPEREVM_RPC_URL=https://hyperevm.drpc.org
HYPEREVM_RPC_URL=https://hyperevm.publicnode.com
```

#### **Étape 2 : Vérifier la Limite de Gas**
```javascript
// Script de test de connexion
const provider = new ethers.JsonRpcProvider(rpcUrl);
const latestBlock = await provider.getBlock("latest");
console.log("Block gas limit:", latestBlock.gasLimit.toString());
```

### **Solution 2 : Déploiement avec Gas Limit Personnalisé**

#### **Script Optimisé**
```javascript
// Utiliser 80% de la limite de gas du bloc
const maxGasLimit = gasLimit.mul(80).div(100);

const marketplace = await marketplaceFactory.deploy(
    // ... paramètres
    {
        gasLimit: maxGasLimit
    }
);
```

### **Solution 3 : Déploiement Séparé des Contrats**

#### **Ordre Recommandé**
1. **DirectListingsExtensionOpenZeppelin** (plus petit)
2. **OffersOpenZeppelin** (moyen)
3. **MarketplaceV3OpenZeppelin** (plus gros)

#### **Script de Déploiement Séparé**
```javascript
// Déployer un par un avec vérification
for (const contract of contracts) {
    try {
        const deployed = await deployContract(contract);
        console.log(`✅ ${contract.name} deployed at:`, deployed.address);
    } catch (error) {
        console.error(`❌ Failed to deploy ${contract.name}:`, error.message);
        // Continuer avec le suivant
    }
}
```

### **Solution 4 : Optimisation des Contrats**

#### **Compilation avec Optimisations**
```bash
# Foundry avec optimisations
forge build --optimize --optimizer-runs 200

# Hardhat avec optimisations
npx hardhat compile --optimize
```

#### **Configuration Foundry**
```toml
[profile.default]
optimizer = true
optimizer_runs = 200
via_ir = true
```

### **Solution 5 : Déploiement sur Testnet**

#### **Réseaux de Test Recommandés**
1. **Sepolia** : Limite de gas plus élevée
2. **Goerli** : Bon pour les tests
3. **Local Hardhat** : Contrôle total

## 🧪 Tests et Validation

### **Test de Connexion**
```bash
# Tester la connexion au réseau
node test-connection.js

# Vérifier les paramètres du réseau
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  $HYPEREVM_RPC_URL
```

### **Test de Déploiement Local**
```bash
# Déployer localement d'abord
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## 📊 Monitoring et Debugging

### **Logs de Gas**
```javascript
// Activer les logs détaillés
const tx = await contract.deploy();
console.log("Gas used:", tx.gasLimit.toString());
console.log("Gas price:", tx.gasPrice?.toString() || "N/A");
```

### **Estimation de Gas**
```javascript
// Estimer le gas avant déploiement
const gasEstimate = await contractFactory.getDeployTransaction().gasLimit;
console.log("Estimated gas:", gasEstimate.toString());

if (gasEstimate.gt(blockGasLimit)) {
    console.log("⚠️  Gas estimate exceeds block limit!");
}
```

## 🚀 Stratégies de Déploiement

### **Stratégie 1 : Déploiement Progressif**
1. Déployer les contrats simples d'abord
2. Tester chaque contrat individuellement
3. Déployer le contrat principal en dernier

### **Stratégie 2 : Déploiement avec Proxy**
1. Déployer une version simplifiée
2. Utiliser un pattern proxy pour les mises à jour
3. Éviter les redéploiements complets

### **Stratégie 3 : Déploiement en Parties**
1. Diviser le contrat en modules plus petits
2. Déployer chaque module séparément
3. Utiliser des interfaces pour la communication

## 🔍 Vérification Post-Déploiement

### **Tests de Fonctionnalité**
```javascript
// Vérifier que chaque contrat fonctionne
const isWorking = await contract.testFunction();
console.log("Contract functionality:", isWorking ? "✅" : "❌");
```

### **Vérification des Rôles**
```javascript
// Vérifier la configuration des rôles
const hasRole = await contract.hasRole(ADMIN_ROLE, deployer);
console.log("Admin role configured:", hasRole ? "✅" : "❌");
```

## 📚 Ressources et Support

### **Documentation HyperEVM**
- [HyperEVM Documentation](https://docs.hyperevm.com/)
- [RPC Endpoints](https://hyperevm.com/rpc)
- [Gas Configuration](https://hyperevm.com/gas)

### **Communauté**
- [HyperEVM Discord](https://discord.gg/hyperevm)
- [Telegram Group](https://t.me/hyperevm)
- [GitHub Issues](https://github.com/hyperevm/hyperevm/issues)

## 🎯 Prochaines Étapes

### **Immédiat**
1. ✅ Identifier l'URL RPC correcte d'HyperEVM
2. 🔄 Tester la connexion au réseau
3. 🔄 Vérifier la limite de gas du réseau

### **Court Terme**
1. 🔄 Optimiser la compilation des contrats
2. 🔄 Tester le déploiement avec gas limit personnalisé
3. 🔄 Considérer le déploiement séparé

### **Long Terme**
1. 🔄 Optimiser la taille des contrats
2. 🔄 Implémenter des patterns de déploiement avancés
3. 🔄 Documenter les bonnes pratiques

---

## 💡 Conseils Rapides

- **Toujours tester localement** avant de déployer
- **Vérifier la configuration du réseau** avant le déploiement
- **Utiliser des optimisations de compilation** pour réduire la taille
- **Considérer le déploiement progressif** pour les gros contrats
- **Monitorer l'utilisation du gas** pendant le déploiement

---

**Le problème de gas limit est courant et résolvable ! 🚀**
