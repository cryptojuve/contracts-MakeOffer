#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function diagnoseDirectListings() {
    console.log("🔍 DIAGNOSTIC SPÉCIFIQUE DE DIRECTLISTINGS...");
    console.log("=".repeat(60));

    // Configuration
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Adresses des contrats
    const directListingsAddress = "0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32";
    const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";

    console.log("📍 Adresses des Contrats:");
    console.log("🏪 DirectListingsExtension:", directListingsAddress);
    console.log("🏢 MarketplaceV3:", marketplaceAddress);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // ===== PHASE 1: VÉRIFICATION DU CODE =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DU CODE");
        console.log("=".repeat(50));

        const directListingsCode = await provider.getCode(directListingsAddress);
        if (directListingsCode === "0x") {
            console.error("❌ DirectListingsExtension n'a pas de code");
            process.exit(1);
        }
        console.log("✅ DirectListingsExtension a du code");
        console.log("📏 Longueur du code:", directListingsCode.length, "caractères");

        // ===== PHASE 2: TEST DES FONCTIONS =====
        console.log("\n🧪 PHASE 2: TEST DES FONCTIONS");
        console.log("=".repeat(50));

        // Charger l'ABI
        const DirectListingsExtensionABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/DirectListingsExtension.sol/DirectListingsExtension.json"), "utf8")
        ).abi;

        const directListings = new ethers.Contract(directListingsAddress, DirectListingsExtensionABI, provider);

        // Test des fonctions critiques
        try {
            const adminRole = await directListings.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ DEFAULT_ADMIN_ROLE échoue:", error.message);
        }

        try {
            const totalListings = await directListings.totalListings();
            console.log("✅ totalListings:", totalListings.toString());
        } catch (error) {
            console.error("❌ totalListings échoue:", error.message);
        }

        try {
            const nativeWrapper = await directListings.nativeTokenWrapper();
            console.log("✅ nativeTokenWrapper:", nativeWrapper);
        } catch (error) {
            console.error("❌ nativeTokenWrapper échoue:", error.message);
        }

        // ===== PHASE 3: TEST D'INTERFACE =====
        console.log("\n🔍 PHASE 3: TEST D'INTERFACE");
        console.log("=".repeat(50));

        // Test des fonctions de base
        const basicFunctions = [
            "0x8da5cb5b", // owner()
            "0x01ffc9a7", // supportsInterface()
            "0x18160ddd"  // totalSupply() (si applicable)
        ];

        for (const selector of basicFunctions) {
            try {
                const tx = {
                    to: directListingsAddress,
                    data: selector,
                    from: "0x3E5064AA3e0A17ba1C439AD532A73C6e0D01B6d0"
                };

                const result = await provider.call(tx);
                console.log(`✅ ${selector}: ${result}`);
            } catch (error) {
                console.log(`❌ ${selector}: Échoue`);
            }
        }

        // ===== PHASE 4: TEST DE LIAISON =====
        console.log("\n🔗 PHASE 4: TEST DE LIAISON");
        console.log("=".repeat(50));

        // Charger l'ABI de la marketplace
        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, provider);

        // Test d'estimation de gas pour addExtension
        const DIRECT_LISTINGS_ID = ethers.keccak256(ethers.toUtf8Bytes("DIRECT_LISTINGS"));
        console.log("🆔 ID de l'extension:", DIRECT_LISTINGS_ID);

        try {
            console.log("\n🧪 Test d'estimation de gas...");

            // Créer une transaction d'estimation
            const tx = {
                to: marketplaceAddress,
                data: marketplace.interface.encodeFunctionData("addExtension", [
                    DIRECT_LISTINGS_ID,
                    directListingsAddress,
                    "Direct Listings Extension"
                ]),
                from: "0x3E5064AA3e0A17ba1C439AD532A73C6e0D01B6d0"
            };

            // Essayer d'estimer le gas
            const gasEstimate = await provider.estimateGas(tx);
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());

        } catch (error) {
            console.error("❌ Erreur d'estimation de gas:", error.message);

            // Analyser l'erreur plus en détail
            if (error.code === 'CALL_EXCEPTION') {
                console.log("💡 CALL_EXCEPTION - Le contrat s'arrête lors de l'exécution");
                console.log("   Cela peut indiquer un problème dans DirectListingsExtension");
            }
        }

        // ===== PHASE 5: RECOMMANDATIONS =====
        console.log("\n💡 PHASE 5: RECOMMANDATIONS");
        console.log("=".repeat(50));

        console.log("\n🔍 DIAGNOSTIC FINAL:");
        console.log("   - DirectListingsExtension a du code déployé");
        console.log("   - Mais certaines fonctions peuvent échouer");
        console.log("   - Le problème semble être dans l'implémentation");

        console.log("\n🛠️  SOLUTIONS RECOMMANDÉES:");
        console.log("   1. 🔍 Vérifier le code source de DirectListingsExtension");
        console.log("   2. 🔧 Corriger les problèmes d'implémentation");
        console.log("   3. 🔄 Recompiler et redéployer si nécessaire");

        console.log("\n🚀 PLAN D'ACTION:");
        console.log("   1. Examiner le contrat DirectListingsExtension.sol");
        console.log("   2. Identifier et corriger les problèmes");
        console.log("   3. Recompiler avec forge build");
        console.log("   4. Redéployer si nécessaire");

    } catch (error) {
        console.error("❌ Erreur lors du diagnostic:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    diagnoseDirectListings().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
