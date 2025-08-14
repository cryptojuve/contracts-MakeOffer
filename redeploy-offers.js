#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function redeployOffers() {
    console.log("🚀 REDÉPLOIEMENT DU CONTRAT OFFERS...");
    console.log("=".repeat(60));

    // Configuration
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY non définie dans l'environnement");
        console.log("💡 Utilisez: export PRIVATE_KEY=votre_clé_privée");
        process.exit(1);
    }

    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
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
            console.error("❌ Solde insuffisant pour le redéploiement");
            process.exit(1);
        }

        // Adresses des contrats existants
        const oldOffersAddress = "0x97541DFbe88427F02400F0Efb7d0679C32C76d0e";
        const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";

        console.log("\n📍 Contrats existants:");
        console.log("🎯 Offers (ancien):", oldOffersAddress);
        console.log("🏢 MarketplaceV3:", marketplaceAddress);

        // Charger le bytecode et l'ABI
        console.log("\n📋 Chargement du bytecode et ABI...");

        const OffersArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        );

        const OffersABI = OffersArtifact.abi;
        const OffersBytecode = OffersArtifact.bytecode.object;

        console.log("✅ ABI chargé");
        console.log("✅ Bytecode chargé");

        // ===== PHASE 1: VÉRIFICATION DU CONTRAT EXISTANT =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DU CONTRAT EXISTANT");
        console.log("=".repeat(50));

        // Vérifier que l'ancien contrat existe toujours
        const oldOffersCode = await provider.getCode(oldOffersAddress);
        if (oldOffersCode === "0x") {
            console.log("ℹ️  L'ancien contrat Offers n'existe plus");
        } else {
            console.log("⚠️  L'ancien contrat Offers existe encore");
            console.log("   Adresse:", oldOffersAddress);
            console.log("   Code:", oldOffersCode.slice(0, 66) + "...");
        }

        // ===== PHASE 2: REDÉPLOIEMENT =====
        console.log("\n🚀 PHASE 2: REDÉPLOIEMENT DU CONTRAT OFFERS");
        console.log("=".repeat(50));

        console.log("\n🏗️  Déploiement en cours...");

        // Créer la factory du contrat
        const OffersFactory = new ethers.ContractFactory(OffersABI, OffersBytecode, wallet);

        // Déployer avec les paramètres du constructeur
        // D'après le code source, le constructeur prend (address _admin)
        const deployTx = await OffersFactory.getDeployTransaction(wallet.address);

        console.log("📝 Transaction de déploiement créée");
        console.log("   Gas estimé:", deployTx.gasLimit?.toString() || "Non estimé");

        // Déployer le contrat
        const offers = await OffersFactory.deploy(wallet.address);

        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", offers.deploymentTransaction().hash);

        // Attendre la confirmation
        const receipt = await offers.waitForDeployment();
        const newOffersAddress = await offers.getAddress();

        console.log("✅ Contrat Offers redéployé avec succès !");
        console.log("   Nouvelle adresse:", newOffersAddress);
        console.log("   Block:", receipt.blockNumber);
        console.log("   Gas utilisé:", receipt.gasUsed.toString());

        // ===== PHASE 3: VÉRIFICATION DU NOUVEAU CONTRAT =====
        console.log("\n✅ PHASE 3: VÉRIFICATION DU NOUVEAU CONTRAT");
        console.log("=".repeat(50));

        // Vérifier le code du nouveau contrat
        const newOffersCode = await provider.getCode(newOffersAddress);
        if (newOffersCode === "0x") {
            console.error("❌ Le nouveau contrat n'a pas de code");
            process.exit(1);
        }
        console.log("✅ Nouveau contrat a du code");

        // Créer l'instance du nouveau contrat
        const newOffers = new ethers.Contract(newOffersAddress, OffersABI, wallet);

        // Tester les fonctions critiques
        console.log("\n🧪 Test des fonctions critiques...");

        try {
            const adminRole = await newOffers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const hasAdminRole = await newOffers.hasRole(await newOffers.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const totalOffers = await newOffers.totalOffers();
            console.log("✅ totalOffers:", totalOffers.toString());
        } catch (error) {
            console.error("❌ totalOffers échoue:", error.message);
        }

        try {
            const offerorRole = await newOffers.OFFEROR_ROLE();
            console.log("✅ OFFEROR_ROLE:", offerorRole);
        } catch (error) {
            console.error("❌ Erreur OFFEROR_ROLE:", error.message);
        }

        try {
            const managerRole = await newOffers.MANAGER_ROLE();
            console.log("✅ MANAGER_ROLE:", managerRole);
        } catch (error) {
            console.error("❌ Erreur MANAGER_ROLE:", error.message);
        }

        // ===== PHASE 4: MISE À JOUR DES RÉFÉRENCES =====
        console.log("\n🔄 PHASE 4: MISE À JOUR DES RÉFÉRENCES");
        console.log("=".repeat(50));

        console.log("\n📝 NOUVELLES ADRESSES À UTILISER:");
        console.log("🎯 Offers:", newOffersAddress);
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🏪 DirectListingsExtension: 0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32");

        // ===== PHASE 5: TEST D'AJOUT D'EXTENSION =====
        console.log("\n🔗 PHASE 5: TEST D'AJOUT D'EXTENSION");
        console.log("=".repeat(50));

        // Charger l'ABI de la marketplace
        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, wallet);

        // Tester l'ajout de l'extension Offers
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        console.log("🆔 ID de l'extension Offers:", OFFERS_ID);

        try {
            console.log("\n🧪 Test d'ajout de l'extension Offers...");

            // Estimation de gas
            const gasEstimate = await marketplace.addExtension.estimateGas(
                OFFERS_ID,
                newOffersAddress,
                "Offers Extension"
            );
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());

            // Ajout de l'extension
            console.log("🚀 Ajout de l'extension...");
            const tx = await marketplace.addExtension(
                OFFERS_ID,
                newOffersAddress,
                "Offers Extension",
                { gasLimit: gasEstimate + 50000n }
            );

            console.log("⏳ Transaction envoyée:", tx.hash);
            const addReceipt = await tx.wait();
            console.log("✅ Extension Offers ajoutée avec succès !");
            console.log("   Block:", addReceipt.blockNumber);
            console.log("   Gas utilisé:", addReceipt.gasUsed.toString());

        } catch (error) {
            console.error("❌ Erreur lors de l'ajout de l'extension:", error.message);
        }

        // ===== RÉSUMÉ FINAL =====
        console.log("\n🎉 RÉSUMÉ DU REDÉPLOIEMENT");
        console.log("=".repeat(50));

        console.log("✅ Actions réussies:");
        console.log("   1. Redéploiement du contrat Offers");
        console.log("   2. Vérification des fonctions");
        console.log("   3. Test d'ajout d'extension");

        console.log("\n📍 Nouvelles adresses:");
        console.log("   🎯 Offers:", newOffersAddress);
        console.log("   🏢 MarketplaceV3:", marketplaceAddress);
        console.log("   🏪 DirectListingsExtension: 0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32");

        console.log("\n🚀 Prochaines étapes:");
        console.log("   1. Mettre à jour link-extensions.js avec la nouvelle adresse");
        console.log("   2. Relancer le script de liaison des extensions");
        console.log("   3. Vérifier que tout fonctionne");

        console.log("\n💾 Sauvegarde:");
        console.log("   Ancienne adresse Offers:", oldOffersAddress);
        console.log("   Nouvelle adresse Offers:", newOffersAddress);

    } catch (error) {
        console.error("❌ Erreur lors du redéploiement:", error.message);
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
    redeployOffers().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
