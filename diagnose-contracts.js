#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function diagnoseContracts() {
    console.log("🔍 Diagnostic des Contrats Déployés...");

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

        // Adresses des contrats (utiliser celles du script précédent)
        const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";
        const directListingsAddress = "0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32";
        const offersAddress = "0x97541DFbe88427F02400F0Efb7d0679C32C76d0e";

        console.log("\n📍 Adresses des Contrats:");
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🏪 DirectListingsExtension:", directListingsAddress);
        console.log("🎯 Offers:", offersAddress);

        // Charger les ABIs
        console.log("\n📋 Chargement des ABIs...");

        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const DirectListingsExtensionABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/DirectListingsExtension.sol/DirectListingsExtension.json"), "utf8")
        ).abi;

        const OffersABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        ).abi;

        // Créer les instances des contrats
        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, wallet);
        const directListings = new ethers.Contract(directListingsAddress, DirectListingsExtensionABI, wallet);
        const offers = new ethers.Contract(offersAddress, OffersABI, wallet);

        // ===== DIAGNOSTIC MARKETPLACE =====
        console.log("\n🔍 DIAGNOSTIC MARKETPLACE:");
        console.log("=".repeat(50));

        try {
            const marketplaceAdmin = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", marketplaceAdmin);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const extensionRole = await marketplace.EXTENSION_ROLE();
            console.log("✅ EXTENSION_ROLE:", extensionRole);
        } catch (error) {
            console.error("❌ Erreur EXTENSION_ROLE:", error.message);
        }

        try {
            const hasAdminRole = await marketplace.hasRole(await marketplace.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasAdminRole);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const hasExtensionRole = await marketplace.hasRole(await marketplace.EXTENSION_ROLE(), wallet.address);
            console.log("✅ Déployeur a EXTENSION_ROLE:", hasExtensionRole);
        } catch (error) {
            console.error("❌ Erreur vérification extension:", error.message);
        }

        try {
            const platformFee = await marketplace.getPlatformFee();
            console.log("✅ Platform Fee:", platformFee);
        } catch (error) {
            console.error("❌ Erreur platform fee:", error.message);
        }

        try {
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions existantes:", allExtensions.length);
            for (const extId of allExtensions) {
                const ext = await marketplace.getExtension(extId);
                console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'})`);
            }
        } catch (error) {
            console.error("❌ Erreur extensions:", error.message);
        }

        // ===== DIAGNOSTIC DIRECTLISTINGS =====
        console.log("\n🔍 DIAGNOSTIC DIRECTLISTINGS:");
        console.log("=".repeat(50));

        try {
            const directListingsAdmin = await directListings.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", directListingsAdmin);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const hasDirectListingsAdmin = await directListings.hasRole(await directListings.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasDirectListingsAdmin);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const totalListings = await directListings.totalListings();
            console.log("✅ Total Listings:", totalListings.toString());
        } catch (error) {
            console.error("❌ Erreur total listings:", error.message);
        }

        try {
            const nativeWrapper = await directListings.nativeTokenWrapper();
            console.log("✅ Native Token Wrapper:", nativeWrapper);
        } catch (error) {
            console.error("❌ Erreur native wrapper:", error.message);
        }

        // ===== DIAGNOSTIC OFFERS =====
        console.log("\n🔍 DIAGNOSTIC OFFERS:");
        console.log("=".repeat(50));

        try {
            const offersAdmin = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", offersAdmin);
        } catch (error) {
            console.error("❌ Erreur DEFAULT_ADMIN_ROLE:", error.message);
        }

        try {
            const hasOffersAdmin = await offers.hasRole(await offers.DEFAULT_ADMIN_ROLE(), wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasOffersAdmin);
        } catch (error) {
            console.error("❌ Erreur vérification admin:", error.message);
        }

        try {
            const totalOffers = await offers.totalOffers();
            console.log("✅ Total Offers:", totalOffers.toString());
        } catch (error) {
            console.error("❌ Erreur total offers:", error.message);
        }

        // ===== TEST D'INTERFACE =====
        console.log("\n🔍 TEST D'INTERFACE:");
        console.log("=".repeat(50));

        // Test IERC165 sur DirectListings
        try {
            const directListingsCode = await provider.getCode(directListingsAddress);
            console.log("✅ Code DirectListings:", directListingsCode.slice(0, 66) + "...");

            // Test si le contrat répond aux appels basiques
            const directListingsOwner = await directListings.owner();
            console.log("✅ Owner DirectListings:", directListingsOwner);
        } catch (error) {
            console.error("❌ Erreur interface DirectListings:", error.message);
        }

        // Test IERC165 sur Offers
        try {
            const offersCode = await provider.getCode(offersAddress);
            console.log("✅ Code Offers:", offersCode.slice(0, 66) + "...");

            // Test si le contrat répond aux appels basiques
            const offersOwner = await offers.owner();
            console.log("✅ Owner Offers:", offersOwner);
        } catch (error) {
            console.error("❌ Erreur interface Offers:", error.message);
        }

        // ===== TEST D'AJOUT D'EXTENSION =====
        console.log("\n🔍 TEST D'AJOUT D'EXTENSION:");
        console.log("=".repeat(50));

        const DIRECT_LISTINGS_ID = ethers.keccak256(ethers.toUtf8Bytes("DIRECT_LISTINGS"));
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));

        console.log("🆔 IDs des Extensions:");
        console.log("DIRECT_LISTINGS:", DIRECT_LISTINGS_ID);
        console.log("OFFERS:", OFFERS_ID);

        // Test d'estimation de gas pour addExtension
        try {
            console.log("\n🧪 Test d'estimation de gas pour DirectListings...");
            const gasEstimate = await marketplace.addExtension.estimateGas(
                DIRECT_LISTINGS_ID,
                directListingsAddress,
                "Direct Listings Extension"
            );
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());
        } catch (error) {
            console.error("❌ Erreur estimation gas DirectListings:", error.message);
            console.error("   Détails:", error);
        }

        try {
            console.log("\n🧪 Test d'estimation de gas pour Offers...");
            const gasEstimate = await marketplace.addExtension.estimateGas(
                OFFERS_ID,
                offersAddress,
                "Offers Extension"
            );
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());
        } catch (error) {
            console.error("❌ Erreur estimation gas Offers:", error.message);
            console.error("   Détails:", error);
        }

        // ===== RÉSUMÉ =====
        console.log("\n📊 RÉSUMÉ DU DIAGNOSTIC:");
        console.log("=".repeat(50));
        console.log("🏢 MarketplaceV3: Vérifié");
        console.log("🏪 DirectListingsExtension: Vérifié");
        console.log("🎯 Offers: Vérifié");
        console.log("\n💡 Si des erreurs persistent, vérifiez:");
        console.log("   1. Les permissions sur les contrats");
        console.log("   2. L'implémentation des interfaces");
        console.log("   3. Les restrictions de sécurité");

    } catch (error) {
        console.error("❌ Erreur lors du diagnostic:", error.message);
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
    diagnoseContracts().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
