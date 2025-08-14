#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testContractState() {
    console.log("🔍 TEST DE L'ÉTAT ACTUEL DU CONTRAT MARKETPLACE...");
    console.log("=".repeat(70));

    // Configuration
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Adresses des contrats
    const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";

    console.log("📍 Adresse du Contrat MarketplaceV3:", marketplaceAddress);

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

        // ===== PHASE 1: VÉRIFICATION DES RÔLES =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DES RÔLES");
        console.log("=".repeat(50));

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

        // ===== PHASE 2: VÉRIFICATION DES FONCTIONS =====
        console.log("\n🔍 PHASE 2: VÉRIFICATION DES FONCTIONS");
        console.log("=".repeat(50));

        // Vérifier si la fonction addExtension existe
        try {
            const addExtensionFunction = marketplace.interface.getFunction("addExtension");
            console.log("✅ Fonction addExtension trouvée:", addExtensionFunction.name);
            console.log("   Paramètres:", addExtensionFunction.inputs.map(input => `${input.type} ${input.name}`).join(", "));
        } catch (error) {
            console.error("❌ Fonction addExtension non trouvée:", error.message);
        }

        // Vérifier si la fonction getAllExtensionIds existe
        try {
            const getAllExtensionIdsFunction = marketplace.interface.getFunction("getAllExtensionIds");
            console.log("✅ Fonction getAllExtensionIds trouvée:", getAllExtensionIdsFunction.name);
        } catch (error) {
            console.error("❌ Fonction getAllExtensionIds non trouvée:", error.message);
        }

        // ===== PHASE 3: TEST DES APPELS SIMPLES =====
        console.log("\n🔍 PHASE 3: TEST DES APPELS SIMPLES");
        console.log("=".repeat(50));

        // Test de getAllExtensionIds
        try {
            console.log("🧪 Test de getAllExtensionIds...");
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ getAllExtensionIds réussi:", allExtensions);
            console.log("   Nombre d'extensions:", allExtensions.length);

            if (allExtensions.length > 0) {
                for (const extId of allExtensions) {
                    try {
                        const ext = await marketplace.getExtension(extId);
                        console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'}) - ${ext.name}`);
                    } catch (error) {
                        console.log(`   - ${extId}: Erreur lors de la récupération - ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error("❌ getAllExtensionIds échoue:", error.message);

            // Essayer de comprendre l'erreur
            if (error.message.includes("missing revert data")) {
                console.log("💡 Erreur 'missing revert data' - possible problème de gas ou d'exécution");
            } else if (error.message.includes("execution reverted")) {
                console.log("💡 Erreur 'execution reverted' - fonction existe mais échoue");
            } else if (error.message.includes("function not found")) {
                console.log("💡 Erreur 'function not found' - fonction n'existe pas dans le contrat");
            }
        }

        // ===== PHASE 4: VÉRIFICATION DU CODE DU CONTRAT =====
        console.log("\n🔍 PHASE 4: VÉRIFICATION DU CODE DU CONTRAT");
        console.log("=".repeat(50));

        try {
            const code = await provider.getCode(marketplaceAddress);
            if (code === "0x") {
                console.log("❌ Aucun code trouvé à cette adresse");
            } else {
                console.log("✅ Code du contrat trouvé");
                console.log("   Taille du code:", (code.length - 2) / 2, "bytes");

                // Vérifier si c'est un contrat proxy
                if (code.includes("363d3d373d3d3d363d73")) {
                    console.log("🔍 Contrat détecté comme proxy");
                } else {
                    console.log("🔍 Contrat détecté comme implémentation directe");
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification du code:", error.message);
        }

        // ===== PHASE 5: ANALYSE ET RECOMMANDATIONS =====
        console.log("\n🔍 PHASE 5: ANALYSE ET RECOMMANDATIONS");
        console.log("=".repeat(50));

        console.log("\n📊 ANALYSE:");
        console.log("   - Vérification de l'existence des fonctions");
        console.log("   - Test des appels de base");
        console.log("   - Vérification du code du contrat");

        console.log("\n💡 POSSIBLES CAUSES:");
        console.log("   1. Mismatch entre le code déployé et le code source");
        console.log("   2. Problème de compilation ou d'optimisation");
        console.log("   3. Contrat déployé avec une version différente");
        console.log("   4. Problème de gas ou d'exécution sur le réseau");

        console.log("\n🛠️  SOLUTIONS À ESSAYER:");
        console.log("   1. 🔍 Vérifier la correspondance entre le code déployé et le code source");
        console.log("   2. 🧪 Tester avec un nouveau déploiement");
        console.log("   3. 🔧 Vérifier les paramètres de compilation");
        console.log("   4. 📋 Analyser les logs de déploiement");

    } catch (error) {
        console.error("❌ Erreur lors du test:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    testContractState().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
