#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function repairOffers() {
    console.log("🔧 RÉPARATION SPÉCIFIQUE DU CONTRAT OFFERS...");
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
            console.error("❌ Solde insuffisant pour les transactions de réparation");
            process.exit(1);
        }

        // Adresses des contrats
        const offersAddress = "0x97541DFbe88427F02400F0Efb7d0679C32C76d0e";
        const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";

        console.log("\n📍 Contrat à réparer:");
        console.log("🎯 Offers:", offersAddress);

        // Charger l'ABI
        console.log("\n📋 Chargement de l'ABI...");

        const OffersABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        ).abi;

        // Créer l'instance du contrat
        const offers = new ethers.Contract(offersAddress, OffersABI, wallet);

        // ===== PHASE 1: DIAGNOSTIC APPROFONDI OFFERS =====
        console.log("\n🔍 PHASE 1: DIAGNOSTIC APPROFONDI OFFERS");
        console.log("=".repeat(50));

        // Vérifier le code du contrat
        const offersCode = await provider.getCode(offersAddress);
        if (offersCode === "0x") {
            console.error("❌ Offers n'a pas de code (contrat non déployé)");
            process.exit(1);
        }
        console.log("✅ Offers a du code déployé");

        // Vérifier la longueur du code
        const codeLength = offersCode.length;
        console.log("📏 Longueur du code:", codeLength, "caractères");

        if (codeLength < 100) {
            console.warn("⚠️  Code très court - possible problème de déploiement");
        }

        // ===== PHASE 2: TEST DES FONCTIONS CRITIQUES =====
        console.log("\n🧪 PHASE 2: TEST DES FONCTIONS CRITIQUES");
        console.log("=".repeat(50));

        // Test 1: DEFAULT_ADMIN_ROLE
        try {
            const adminRole = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        // Test 2: Vérifier les permissions
        try {
            const hasAdminRole = await offers.hasRole(await offers.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        // Test 3: totalOffers (fonction problématique)
        try {
            const totalOffers = await offers.totalOffers();
            console.log("✅ totalOffers:", totalOffers.toString());
        } catch (error) {
            console.error("❌ totalOffers échoue:", error.message);

            // Analyser l'erreur plus en détail
            if (error.code === 'CALL_EXCEPTION') {
                console.log("💡 CALL_EXCEPTION - Le contrat s'arrête lors de l'exécution");

                // Essayer de récupérer plus d'informations sur l'erreur
                try {
                    const tx = {
                        to: offersAddress,
                        data: "0xa9fd8ed1", // totalOffers() selector
                        from: wallet.address
                    };

                    const result = await provider.call(tx);
                    console.log("✅ Appel direct réussi:", result);
                } catch (directError) {
                    console.log("❌ Appel direct échoue aussi:", directError.message);
                }
            }
        }

        // Test 4: Autres fonctions de base
        try {
            const offerorRole = await offers.OFFEROR_ROLE();
            console.log("✅ OFFEROR_ROLE:", offerorRole);
        } catch (error) {
            console.error("❌ Erreur OFFEROR_ROLE:", error.message);
        }

        try {
            const managerRole = await offers.MANAGER_ROLE();
            console.log("✅ MANAGER_ROLE:", managerRole);
        } catch (error) {
            console.error("❌ Erreur MANAGER_ROLE:", error.message);
        }

        // ===== PHASE 3: TENTATIVE DE RÉPARATION =====
        console.log("\n🔧 PHASE 3: TENTATIVE DE RÉPARATION");
        console.log("=".repeat(50));

        // Essayer d'appeler des fonctions qui pourraient "réveiller" le contrat
        console.log("\n🧪 Tentative de réveil du contrat...");

        try {
            // Essayer d'appeler une fonction simple
            const isPaused = await offers.paused();
            console.log("✅ paused():", isPaused);
        } catch (error) {
            console.log("❌ paused() échoue:", error.message);
        }

        try {
            // Essayer d'appeler une fonction de rôle
            const hasOfferorRole = await offers.hasRole(await offers.OFFEROR_ROLE(), wallet.address);
            console.log("✅ hasOfferorRole:", hasOfferorRole);
        } catch (error) {
            console.log("❌ hasOfferorRole échoue:", error.message);
        }

        // ===== PHASE 4: DIAGNOSTIC DU PROBLÈME =====
        console.log("\n🔍 PHASE 4: DIAGNOSTIC DU PROBLÈME");
        console.log("=".repeat(50));

        // Analyser le code du contrat pour identifier le problème
        console.log("\n📊 Analyse du code du contrat...");

        // Vérifier si le contrat a des fonctions de base
        const basicFunctions = [
            "0x8da5cb5b", // owner()
            "0x18160ddd", // totalSupply() (si ERC20)
            "0x01ffc9a7", // supportsInterface()
            "0x3659cfe6"  // implementation() (si proxy)
        ];

        for (const selector of basicFunctions) {
            try {
                const tx = {
                    to: offersAddress,
                    data: selector,
                    from: wallet.address
                };

                const result = await provider.call(tx);
                console.log(`✅ ${selector}: ${result}`);
            } catch (error) {
                console.log(`❌ ${selector}: Échoue`);
            }
        }

        // ===== PHASE 5: RECOMMANDATIONS =====
        console.log("\n💡 PHASE 5: RECOMMANDATIONS");
        console.log("=".repeat(50));

        console.log("\n🔍 DIAGNOSTIC FINAL:");
        console.log("   - Le contrat Offers a du code déployé");
        console.log("   - Mais certaines fonctions critiques échouent");
        console.log("   - Le problème semble être dans l'implémentation");

        console.log("\n🛠️  SOLUTIONS RECOMMANDÉES:");
        console.log("   1. 🔴 REDÉPLOYER le contrat Offers");
        console.log("   2. 🔍 Vérifier les paramètres du constructeur");
        console.log("   3. ✅ S'assurer que le déploiement est complet");

        console.log("\n🚀 PLAN D'ACTION:");
        console.log("   1. Sauvegarder l'adresse actuelle");
        console.log("   2. Redéployer Offers avec les bons paramètres");
        console.log("   3. Mettre à jour les références");
        console.log("   4. Relancer link-extensions.js");

        console.log("\n⚠️  ATTENTION:");
        console.log("   - Le redéploiement changera l'adresse du contrat");
        console.log("   - Toutes les références devront être mises à jour");
        console.log("   - Les données existantes seront perdues");

    } catch (error) {
        console.error("❌ Erreur lors de la réparation d'Offers:", error.message);
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
    repairOffers().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
