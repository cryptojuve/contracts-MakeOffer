#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMarketplaceAddExtension() {
    console.log("🧪 TEST DIRECT DE LA FONCTION ADDEXTENSION DE LA MARKETPLACE...");
    console.log("=" .repeat(70));

    // Configuration
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Adresses des contrats
    const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";
    const offersAddress = "0x5eF000e2a094970B59d089aE01649B3B5908f9c8";

    console.log("📍 Adresses des Contrats:");
    console.log("🏢 MarketplaceV3:", marketplaceAddress);
    console.log("🎯 Offers:", offersAddress);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // Charger l'ABI de la marketplace
        console.log("\n📋 Chargement de l'ABI MarketplaceV3...");
        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, provider);

        // ===== PHASE 1: VÉRIFICATION DE LA MARKETPLACE =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DE LA MARKETPLACE");
        console.log("=" .repeat(50));

        try {
            const adminRole = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ DEFAULT_ADMIN_ROLE échoue:", error.message);
        }

        try {
            const extensionRole = await marketplace.EXTENSION_ROLE();
            console.log("✅ EXTENSION_ROLE:", extensionRole);
        } catch (error) {
            console.error("❌ EXTENSION_ROLE échoue:", error.message);
        }

        try {
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions existantes:", allExtensions.length);
            for (const extId of allExtensions) {
                try {
                    const ext = await marketplace.getExtension(extId);
                    console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'})`);
                } catch (error) {
                    console.log(`   - ${extId}: Erreur lors de la récupération`);
                }
            }
        } catch (error) {
            console.error("❌ getAllExtensionIds échoue:", error.message);
        }

        // ===== PHASE 2: TEST DIRECT D'ADDEXTENSION =====
        console.log("\n🧪 PHASE 2: TEST DIRECT D'ADDEXTENSION");
        console.log("=" .repeat(50));

        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        console.log("🆔 ID de l'extension Offers:", OFFERS_ID);

        // Test 1: Appel direct sans estimation de gas
        console.log("\n🧪 Test 1: Appel direct sans estimation de gas...");
        try {
            const tx = {
                to: marketplaceAddress,
                data: marketplace.interface.encodeFunctionData("addExtension", [
                    OFFERS_ID,
                    offersAddress,
                    "Offers Extension"
                ]),
                from: "0x3E5064AA3e0A17ba1C439AD532A73C6e0D01B6d0"
            };

            const result = await provider.call(tx);
            console.log("✅ Appel direct réussi:", result);
        } catch (error) {
            console.error("❌ Appel direct échoue:", error.message);
        }

        // Test 2: Vérification des paramètres
        console.log("\n🧪 Test 2: Vérification des paramètres...");
        console.log("   Extension ID:", OFFERS_ID);
        console.log("   Extension Address:", offersAddress);
        console.log("   Extension Name:", "Offers Extension");

        // Test 3: Vérification de l'état actuel
        console.log("\n🧪 Test 3: Vérification de l'état actuel...");
        try {
            const existingOffers = await marketplace.getExtension(OFFERS_ID);
            if (existingOffers.extension !== ethers.ZeroAddress) {
                console.log("⚠️  Extension déjà enregistrée:");
                console.log("   Adresse:", existingOffers.extension);
                console.log("   Activée:", existingOffers.enabled);
                console.log("   Nom:", existingOffers.name);
            } else {
                console.log("ℹ️  Extension non enregistrée");
            }
        } catch (error) {
            console.log("ℹ️  Extension non enregistrée (erreur lors de la vérification)");
        }

        // ===== PHASE 3: ANALYSE DU PROBLÈME =====
        console.log("\n🔍 PHASE 3: ANALYSE DU PROBLÈME");
        console.log("=" .repeat(50));

        console.log("\n📊 ANALYSE:");
        console.log("   - La marketplace répond aux appels de base");
        console.log("   - La fonction addExtension échoue lors de l'estimation de gas");
        console.log("   - L'erreur 'missing revert data' suggère un problème interne");
        
        console.log("\n💡 POSSIBLES CAUSES:");
        console.log("   1. Vérification interne dans addExtension qui échoue");
        console.log("   2. Problème avec les paramètres passés");
        console.log("   3. Contrainte de sécurité dans la marketplace");
        console.log("   4. Problème de compatibilité d'interface");

        // ===== PHASE 4: RECOMMANDATIONS =====
        console.log("\n💡 PHASE 4: RECOMMANDATIONS");
        console.log("=" .repeat(50));

        console.log("\n🛠️  SOLUTIONS À ESSAYER:");
        console.log("   1. 🔍 Examiner le code source de MarketplaceV3");
        console.log("   2. 🧪 Tester avec des paramètres différents");
        console.log("   3. 🔧 Vérifier les contraintes de la fonction addExtension");
        console.log("   4. 📋 Analyser les logs de déploiement de la marketplace");
        
        console.log("\n🚀 PLAN D'ACTION:");
        console.log("   1. Vérifier le code source de MarketplaceV3.addExtension");
        console.log("   2. Identifier les vérifications qui échouent");
        console.log("   3. Corriger le problème à la source");
        console.log("   4. Recompiler et redéployer si nécessaire");

    } catch (error) {
        console.error("❌ Erreur lors du test:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    testMarketplaceAddExtension().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
