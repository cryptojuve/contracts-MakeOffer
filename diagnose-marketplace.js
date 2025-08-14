#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function diagnoseMarketplace() {
    console.log("🔍 DIAGNOSTIC DU MARKETPLACE...");
    console.log("=".repeat(50));

    // Configuration
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY non définie dans l'environnement");
        console.log("💡 Utilisez: export PRIVATE_KEY=votre_clé_privée");
        process.exit(1);
    }

    // RPC HyperLiquid testnet
    const rpcUrl = "https://rpc.hyperliquid-testnet.xyz/evm";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Adresses des contrats déployés
    const marketplaceAddress = "0x2E948004Ede4813885b11c65857790f721C22A08";
    const offersAddress = "0xdB1C2F553B38B395A5287DB9d07204dC4658e0e9";
    const directListingsAddress = "0x085fcAA66f07d07381D56EF17E59CcD0AAe40A3C";

    console.log("📱 Déployeur:", wallet.address);
    console.log("🔗 RPC Testnet:", rpcUrl);
    console.log("🏢 Marketplace:", marketplaceAddress);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperLiquid Testnet");
        console.log("🔗 Chain ID:", network.chainId);

        // Charger l'ABI de la marketplace
        console.log("\n📋 Chargement de l'ABI MarketplaceV3...");
        const MarketplaceV3Artifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3Artifact, wallet);

        // ===== PHASE 1: VÉRIFICATION DES RÔLES =====
        console.log("\n🔐 PHASE 1: VÉRIFICATION DES RÔLES");
        console.log("=".repeat(40));

        try {
            const DEFAULT_ADMIN_ROLE = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);

            const EXTENSION_ROLE = await marketplace.EXTENSION_ROLE();
            console.log("✅ EXTENSION_ROLE:", EXTENSION_ROLE);

            const hasAdminRole = await marketplace.hasRole(DEFAULT_ADMIN_ROLE, wallet.address);
            console.log("👑 Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);

            const hasExtensionRole = await marketplace.hasRole(EXTENSION_ROLE, wallet.address);
            console.log("🔧 Déployeur a EXTENSION_ROLE:", hasExtensionRole);

            if (!hasExtensionRole) {
                console.log("⚠️  Le déployeur n'a pas EXTENSION_ROLE !");
                console.log("💡 Attribution du rôle EXTENSION_ROLE...");

                try {
                    const grantTx = await marketplace.grantRole(EXTENSION_ROLE, wallet.address, { gasLimit: 500000 });
                    console.log("⏳ Attribution du rôle en cours, hash:", grantTx.hash);
                    const grantReceipt = await grantTx.wait();
                    console.log("✅ Rôle EXTENSION_ROLE attribué ! Gas utilisé:", grantReceipt.gasUsed.toString());
                } catch (error) {
                    console.error("❌ Erreur lors de l'attribution du rôle:", error.message);
                }
            }

        } catch (error) {
            console.error("❌ Erreur lors de la vérification des rôles:", error.message);
        }

        // ===== PHASE 2: VÉRIFICATION DES EXTENSIONS =====
        console.log("\n🔍 PHASE 2: VÉRIFICATION DES EXTENSIONS");
        console.log("=".repeat(40));

        try {
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions enregistrées:", allExtensions.length);

            if (allExtensions.length > 0) {
                for (const extId of allExtensions) {
                    try {
                        const ext = await marketplace.getExtension(extId);
                        console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'}) - ${ext.name}`);

                        // Vérifier si c'est l'extension Offers
                        if (ext.extension.toLowerCase() === offersAddress.toLowerCase()) {
                            console.log("      🎯 C'est l'extension Offers !");
                        }
                        if (ext.extension.toLowerCase() === directListingsAddress.toLowerCase()) {
                            console.log("      📋 C'est l'extension DirectListings !");
                        }
                    } catch (error) {
                        console.log(`   - ${extId}: Erreur lors de la récupération`);
                    }
                }
            } else {
                console.log("ℹ️  Aucune extension enregistrée pour le moment");
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification des extensions:", error.message);
        }

        // ===== PHASE 3: TEST D'AJOUT D'EXTENSION =====
        console.log("\n🧪 PHASE 3: TEST D'AJOUT D'EXTENSION");
        console.log("=".repeat(40));

        // Vérifier si l'extension Offers existe déjà
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        console.log("🎯 ID de l'extension Offers:", OFFERS_ID);

        try {
            const hasOffersExtension = await marketplace.hasExtension(OFFERS_ID);
            console.log("🔍 Extension Offers existe déjà:", hasOffersExtension);

            if (hasOffersExtension) {
                console.log("ℹ️  L'extension Offers est déjà enregistrée, pas besoin de l'ajouter");
            } else {
                console.log("➕ L'extension Offers n'existe pas, testons l'ajout...");

                try {
                    const testTx = await marketplace.addExtension(
                        OFFERS_ID,
                        offersAddress,
                        "Offers Extension",
                        { gasLimit: 800000 }
                    );
                    console.log("✅ Test addExtension réussi ! Hash:", testTx.hash);
                    const testReceipt = await testTx.wait();
                    console.log("   Gas utilisé:", testReceipt.gasUsed.toString());
                } catch (error) {
                    console.error("❌ Test addExtension échoué:", error.message);
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification:", error.message);
        }

        // ===== PHASE 4: VÉRIFICATION FINALE =====
        console.log("\n🔍 PHASE 4: VÉRIFICATION FINALE");
        console.log("=".repeat(40));

        try {
            const finalExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions finales:", finalExtensions.length);

            for (const extId of finalExtensions) {
                try {
                    const ext = await marketplace.getExtension(extId);
                    console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'}) - ${ext.name}`);
                } catch (error) {
                    console.log(`   - ${extId}: Erreur lors de la récupération`);
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification finale:", error.message);
        }

        // ===== PHASE 5: RÉSUMÉ =====
        console.log("\n📊 RÉSUMÉ DU DIAGNOSTIC");
        console.log("=".repeat(40));

        console.log("🎯 Objectif: Résoudre l'erreur 'transaction execution reverted'");
        console.log("🔍 Cause probable: Extension déjà existante ou problème de rôles");
        console.log("💡 Solution: Vérifier l'état actuel et corriger les rôles si nécessaire");

    } catch (error) {
        console.error("❌ Erreur lors du diagnostic:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    diagnoseMarketplace().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
