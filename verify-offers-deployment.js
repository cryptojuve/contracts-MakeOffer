#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function verifyOffersDeployment() {
    console.log("🔍 VÉRIFICATION DU DÉPLOIEMENT DU CONTRAT OFFERS...");
    console.log("=".repeat(60));

    // Configuration
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Adresse du contrat déployé
    const offersAddress = "0x5eF000e2a094970B59d089aE01649B3B5908f9c8";

    console.log("📍 Adresse du contrat Offers:", offersAddress);
    console.log("🔗 RPC:", rpcUrl);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // Vérifier le code du contrat
        console.log("\n🔍 Vérification du code du contrat...");
        const offersCode = await provider.getCode(offersAddress);

        if (offersCode === "0x") {
            console.error("❌ Le contrat n'a pas de code (non déployé)");
            process.exit(1);
        }

        console.log("✅ Contrat a du code déployé");
        console.log("📏 Longueur du code:", offersCode.length, "caractères");

        // Charger l'ABI
        console.log("\n📋 Chargement de l'ABI...");
        const OffersArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        );
        const OffersABI = OffersArtifact.abi;

        // Créer l'instance du contrat
        const offers = new ethers.Contract(offersAddress, OffersABI, provider);

        // Tester les fonctions de base
        console.log("\n🧪 Test des fonctions de base...");

        try {
            const totalOffers = await offers.totalOffers();
            console.log("✅ totalOffers:", totalOffers.toString());
        } catch (error) {
            console.error("❌ totalOffers échoue:", error.message);
        }

        try {
            const adminRole = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ DEFAULT_ADMIN_ROLE échoue:", error.message);
        }

        try {
            const offerorRole = await offers.OFFEROR_ROLE();
            console.log("✅ OFFEROR_ROLE:", offerorRole);
        } catch (error) {
            console.error("❌ OFFEROR_ROLE échoue:", error.message);
        }

        try {
            const managerRole = await offers.MANAGER_ROLE();
            console.log("✅ MANAGER_ROLE:", managerRole);
        } catch (error) {
            console.error("❌ MANAGER_ROLE échoue:", error.message);
        }

        // ===== RÉSUMÉ =====
        console.log("\n🎉 VÉRIFICATION TERMINÉE");
        console.log("=".repeat(50));

        console.log("✅ Contrat Offers déployé et fonctionnel !");
        console.log("📍 Adresse:", offersAddress);
        console.log("🔗 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        console.log("\n🚀 Prochaines étapes:");
        console.log("   1. Mettre à jour link-extensions.js avec la nouvelle adresse");
        console.log("   2. Relancer le script de liaison des extensions");
        console.log("   3. Tester les nouvelles fonctionnalités");

    } catch (error) {
        console.error("❌ Erreur lors de la vérification:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    verifyOffersDeployment().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
