#!/bin/bash

# Script de déploiement pour ERC721Collection avec Forge
# Assurez-vous d'avoir configuré votre fichier .env avec PRIVATE_KEY

echo "🚀 Déploiement de ERC721Collection avec Forge..."

# Vérification que le fichier .env existe
if [ ! -f .env ]; then
    echo "❌ Fichier .env non trouvé!"
    echo "📝 Copiez env.example vers .env et configurez votre clé privée"
    exit 1
fi

# Chargement des variables d'environnement
source .env

# Vérification de la clé privée
if [ "$PRIVATE_KEY" = "your_private_key_here" ]; then
    echo "❌ Clé privée non configurée dans .env!"
    echo "📝 Remplacez 'your_private_key_here' par votre vraie clé privée"
    exit 1
fi

# Compilation du contrat
echo "🔨 Compilation du contrat..."
forge build

if [ $? -ne 0 ]; then
    echo "❌ Erreur de compilation!"
    exit 1
fi

echo "✅ Compilation réussie!"

# Déploiement sur le réseau spécifié
echo "🚀 Déploiement sur le réseau $NETWORK..."

case $NETWORK in
    "hyperevm")
        echo "📍 Déploiement sur HyperEVM Mainnet..."
        forge script script/DeployERC721.s.sol:DeployERC721 --rpc-url $HYPEREVM_RPC_URL --broadcast --verify
        ;;
    "hyperevm-testnet")
        echo "📍 Déploiement sur HyperEVM Testnet..."
        forge script script/DeployERC721.s.sol:DeployERC721 --rpc-url $HYPEREVM_TESTNET_RPC_URL --broadcast --verify
        ;;
    "base-mainnet")
        echo "📍 Déploiement sur Base Mainnet..."
        forge script script/DeployERC721.s.sol:DeployERC721 --rpc-url $BASE_MAINNET_RPC_URL --broadcast --verify
        ;;
    "base-sepolia")
        echo "📍 Déploiement sur Base Sepolia..."
        forge script script/DeployERC721.s.sol:DeployERC721 --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
        ;;
    *)
        echo "❌ Réseau non reconnu: $NETWORK"
        echo "📝 Configurez NETWORK dans .env avec une des valeurs suivantes:"
        echo "   - hyperevm"
        echo "   - hyperevm-testnet"
        echo "   - base-mainnet"
        echo "   - base-sepolia"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo "🎉 Déploiement réussi!"
    echo "📄 Informations sauvegardées dans deployment-info.txt"
else
    echo "❌ Erreur lors du déploiement!"
    exit 1
fi
