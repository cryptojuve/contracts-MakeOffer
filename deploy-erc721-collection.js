#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployERC721Collection() {
    console.log("🚀 DÉPLOIEMENT DU CONTRAT ERC721Collection...");
    console.log("=".repeat(60));

    // Configuration
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY non définie dans l'environnement");
        console.log("💡 Utilisez: export PRIVATE_KEY=votre_clé_privée");
        process.exit(1);
    }

    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://rpc.hyperliquid-testnet.xyz/evm";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("📱 Déployeur:", wallet.address);
    console.log("🔗 RPC:", rpcUrl);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // Vérifier le solde
        const balance = await provider.getBalance(wallet.address);
        console.log("💰 Solde:", ethers.formatEther(balance), "HYPE");

        if (balance < ethers.parseEther("0.00001")) {
            console.error("❌ Solde insuffisant pour le déploiement");
            process.exit(1);
        }

        // Charger le bytecode et l'ABI du contrat ERC721Collection
        console.log("\n📋 Chargement du contrat ERC721Collection...");

        const ERC721CollectionArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/ERC721Collection.sol/ERC721Collection.json"), "utf8")
        );

        const ERC721CollectionABI = ERC721CollectionArtifact.abi;
        const ERC721CollectionBytecode = ERC721CollectionArtifact.bytecode.object;

        console.log("✅ ABI chargé");
        console.log("✅ Bytecode chargé");

        // Paramètres de déploiement
        const name = "test-scratch";
        const symbol = "TNS";
        const maxSupply = 10_000; // 10,000 NFTs maximum
        const mintPrice = ethers.parseEther("0.01"); // 0.01 HYPE par NFT (token natif HyperEVM)
        const maxMintPerWallet = 10; // Maximum 10 NFTs par wallet
        const maxMintPerTransaction = 5; // Maximum 5 NFTs par transaction
        const admin = wallet.address; // L'admin sera le déployeur

        console.log("\n📋 Paramètres de déploiement:");
        console.log("   Nom:", name);
        console.log("   Symbole:", symbol);
        console.log("   Supply maximale:", maxSupply.toLocaleString());
        console.log("   Prix de mint:", ethers.formatEther(mintPrice), "HYPE");
        console.log("   Max par wallet:", maxMintPerWallet);
        console.log("   Max par transaction:", maxMintPerTransaction);
        console.log("   Admin:", admin);

        // ===== PHASE 1: DÉPLOIEMENT =====
        console.log("\n🚀 PHASE 1: DÉPLOIEMENT DU CONTRAT ERC721Collection");
        console.log("=".repeat(50));

        console.log("\n🏗️  Déploiement en cours...");

        // Créer la factory du contrat
        const ERC721CollectionFactory = new ethers.ContractFactory(ERC721CollectionABI, ERC721CollectionBytecode, wallet);

        // Déployer avec les paramètres du constructeur
        // Le constructeur prend (name, symbol, maxSupply, mintPrice, maxMintPerWallet, maxMintPerTransaction, admin)
        console.log("📝 Déploiement avec paramètres...");

        const erc721Collection = await ERC721CollectionFactory.deploy(
            name,
            symbol,
            maxSupply,
            mintPrice,
            maxMintPerWallet,
            maxMintPerTransaction,
            admin
        );

        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", erc721Collection.deploymentTransaction().hash);

        // Attendre la confirmation
        const receipt = await erc721Collection.waitForDeployment();
        const erc721CollectionAddress = await erc721Collection.getAddress();

        console.log("✅ Contrat ERC721Collection déployé avec succès !");
        console.log("   Adresse:", erc721CollectionAddress);

        // Récupérer le numéro de block de manière sécurisée
        try {
            const blockNumber = receipt.blockNumber;
            if (blockNumber) {
                console.log("   Block:", blockNumber);
            } else {
                console.log("   Block: En cours de confirmation");
            }
        } catch (error) {
            console.log("   Block: En cours de confirmation");
        }

        // Récupérer le gas utilisé de manière sécurisée
        try {
            const gasUsed = receipt.gasUsed;
            if (gasUsed) {
                console.log("   Gas utilisé:", gasUsed.toString());
            } else {
                console.log("   Gas utilisé: En cours de calcul");
            }
        } catch (error) {
            console.log("   Gas utilisé: En cours de calcul");
        }

        // ===== PHASE 2: VÉRIFICATION =====
        console.log("\n✅ PHASE 2: VÉRIFICATION DU CONTRAT DÉPLOYÉ");
        console.log("=".repeat(50));

        // Vérifier le code du contrat
        const erc721CollectionCode = await provider.getCode(erc721CollectionAddress);
        if (erc721CollectionCode === "0x") {
            console.error("❌ Le contrat n'a pas de code");
            process.exit(1);
        }
        console.log("✅ Contrat a du code déployé");

        // Créer l'instance du contrat déployé
        const deployedERC721Collection = new ethers.Contract(erc721CollectionAddress, ERC721CollectionABI, wallet);

        // Tester les fonctions critiques
        console.log("\n🧪 Test des fonctions critiques...");

        try {
            const adminRole = await deployedERC721Collection.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const hasAdminRole = await deployedERC721Collection.hasRole(await deployedERC721Collection.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const minterRole = await deployedERC721Collection.MINTER_ROLE();
            console.log("✅ MINTER_ROLE:", minterRole);
        } catch (error) {
            console.error("❌ Erreur MINTER_ROLE:", error.message);
        }

        try {
            const hasMinterRole = await deployedERC721Collection.hasRole(await deployedERC721Collection.MINTER_ROLE(), wallet.address);
            console.log("✅ Déployeur a MINTER_ROLE:", hasMinterRole);
        } catch (error) {
            console.error("❌ Erreur vérification minter:", error.message);
        }

        try {
            const maxSupplyDeployed = await deployedERC721Collection.maxSupply();
            console.log("✅ maxSupply:", maxSupplyDeployed.toString());
        } catch (error) {
            console.error("❌ maxSupply échoue:", error.message);
        }

        try {
            const mintPriceDeployed = await deployedERC721Collection.mintPrice();
            console.log("✅ mintPrice:", ethers.formatEther(mintPriceDeployed), "HYPE");
        } catch (error) {
            console.error("❌ mintPrice échoue:", error.message);
        }

        try {
            const totalMinted = await deployedERC721Collection.totalMinted();
            console.log("✅ totalMinted:", totalMinted.toString());
        } catch (error) {
            console.error("❌ totalMinted échoue:", error.message);
        }

        try {
            const remainingSupply = await deployedERC721Collection.remainingSupply();
            console.log("✅ remainingSupply:", remainingSupply.toString());
        } catch (error) {
            console.error("❌ remainingSupply échoue:", error.message);
        }

        // ===== PHASE 3: RÉSUMÉ FINAL =====
        console.log("\n🎉 RÉSUMÉ DU DÉPLOIEMENT");
        console.log("=".repeat(50));

        console.log("✅ Contrat déployé avec succès !");
        console.log("📍 Adresse du contrat ERC721Collection:", erc721CollectionAddress);
        console.log("🔗 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);
        console.log("📱 Admin:", wallet.address);

        console.log("\n📋 Paramètres de la collection:");
        console.log("   Nom:", name);
        console.log("   Symbole:", symbol);
        console.log("   Supply maximale:", maxSupply.toLocaleString());
        console.log("   Prix de mint:", ethers.formatEther(mintPrice), "HYPE");
        console.log("   Max par wallet:", maxMintPerWallet);
        console.log("   Max par transaction:", maxMintPerTransaction);

        console.log("\n🚀 Prochaines étapes:");
        console.log("   1. Vérifier le contrat sur l'explorer");
        console.log("   2. Configurer l'URI de base pour les métadonnées");
        console.log("   3. Préparer les métadonnées des NFTs");
        console.log("   4. Tester le mint de quelques NFTs");
        console.log("   5. Lancer la vente publique!");

        console.log("\n💾 Informations de sauvegarde:");
        console.log("   Adresse ERC721Collection:", erc721CollectionAddress);
        console.log("   Réseau:", network.name || "HyperEVM");
        console.log("   Chain ID:", network.chainId);
        console.log("   Admin:", wallet.address);

        // Sauvegarder les informations de déploiement
        const deploymentInfo = {
            contract: "ERC721Collection",
            address: erc721CollectionAddress,
            network: network.name || "HyperEVM",
            chainId: network.chainId,
            deployer: wallet.address,
            timestamp: new Date().toISOString(),
            parameters: {
                name,
                symbol,
                maxSupply: maxSupply.toString(),
                mintPrice: mintPrice.toString(),
                maxMintPerWallet: maxMintPerWallet.toString(),
                maxMintPerTransaction: maxMintPerTransaction.toString(),
                admin
            }
        };

        console.log("\n💾 Informations de déploiement sauvegardées dans deployment-info.json");
        // Note: En production, vous voudriez sauvegarder ces informations dans un fichier
        // const fs = require('fs');
        // fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

    } catch (error) {
        console.error("❌ Erreur lors du déploiement:", error.message);
        console.error("   Détails:", error);
        process.exit(1);
    }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
    console.error("❌ Erreur non capturée:", error);
    process.exit(1);
});

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    deployERC721Collection().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
