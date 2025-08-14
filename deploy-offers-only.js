#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployOffersOnly() {
    console.log("🚀 DÉPLOIEMENT UNIQUEMENT DU CONTRAT OFFERS...");
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
            console.error("❌ Solde insuffisant pour le déploiement");
            process.exit(1);
        }

        // Charger le bytecode et l'ABI du contrat Offers
        console.log("\n📋 Chargement du contrat Offers...");

        const OffersArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        );

        const OffersABI = OffersArtifact.abi;
        const OffersBytecode = OffersArtifact.bytecode.object;

        console.log("✅ ABI chargé");
        console.log("✅ Bytecode chargé");

        // ===== PHASE 1: DÉPLOIEMENT =====
        console.log("\n🚀 PHASE 1: DÉPLOIEMENT DU CONTRAT OFFERS");
        console.log("=".repeat(50));

        console.log("\n🏗️  Déploiement en cours...");

        // Créer la factory du contrat
        const OffersFactory = new ethers.ContractFactory(OffersABI, OffersBytecode, wallet);

        // Déployer avec les paramètres du constructeur
        // Le constructeur prend (address _admin)
        console.log("📝 Déploiement avec admin:", wallet.address);

        const offers = await OffersFactory.deploy(wallet.address);

        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", offers.deploymentTransaction().hash);

        // Attendre la confirmation
        const receipt = await offers.waitForDeployment();
        const offersAddress = await offers.getAddress();

        console.log("✅ Contrat Offers déployé avec succès !");
        console.log("   Adresse:", offersAddress);

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
        const offersCode = await provider.getCode(offersAddress);
        if (offersCode === "0x") {
            console.error("❌ Le contrat n'a pas de code");
            process.exit(1);
        }
        console.log("✅ Contrat a du code déployé");

        // Créer l'instance du contrat déployé
        const deployedOffers = new ethers.Contract(offersAddress, OffersABI, wallet);

        // Tester les fonctions critiques
        console.log("\n🧪 Test des fonctions critiques...");

        try {
            const adminRole = await deployedOffers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const hasAdminRole = await deployedOffers.hasRole(await deployedOffers.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const totalOffers = await deployedOffers.totalOffers();
            console.log("✅ totalOffers:", totalOffers.toString());
        } catch (error) {
            console.error("❌ totalOffers échoue:", error.message);
        }

        try {
            const offerorRole = await deployedOffers.OFFEROR_ROLE();
            console.log("✅ OFFEROR_ROLE:", offerorRole);
        } catch (error) {
            console.error("❌ Erreur OFFEROR_ROLE:", error.message);
        }

        try {
            const managerRole = await deployedOffers.MANAGER_ROLE();
            console.log("✅ MANAGER_ROLE:", managerRole);
        } catch (error) {
            console.error("❌ Erreur MANAGER_ROLE:", error.message);
        }

        // ===== PHASE 3: RÉSUMÉ FINAL =====
        console.log("\n🎉 RÉSUMÉ DU DÉPLOIEMENT");
        console.log("=".repeat(50));

        console.log("✅ Contrat déployé avec succès !");
        console.log("📍 Adresse du contrat Offers:", offersAddress);
        console.log("🔗 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);
        console.log("📱 Admin:", wallet.address);

        console.log("\n🚀 Prochaines étapes:");
        console.log("   1. Mettre à jour link-extensions.js avec la nouvelle adresse");
        console.log("   2. Relancer le script de liaison des extensions");
        console.log("   3. Tester les nouvelles fonctionnalités (offres sur collection + tokens)");

        console.log("\n💾 Informations de sauvegarde:");
        console.log("   Ancienne adresse Offers: 0x97541DFbe88427F02400F0Efb7d0679C32C76d0e");
        console.log("   Nouvelle adresse Offers:", offersAddress);
        console.log("   MarketplaceV3: 0xeEf91cD030F98Ce0330F050A446e3E883604D755");
        console.log("   DirectListingsExtension: 0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32");

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
    deployOffersOnly().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
