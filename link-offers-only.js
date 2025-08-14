#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function linkOffersOnly() {
    console.log("🔗 LIAISON UNIQUEMENT DE L'EXTENSION OFFERS...");
    console.log("=" .repeat(60));

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
            console.error("❌ Solde insuffisant pour les transactions");
            process.exit(1);
        }

        // Adresses des contrats
        const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";
        const offersAddress = "0x5eF000e2a094970B59d089aE01649B3B5908f9c8";

        console.log("\n📍 Adresses des Contrats:");
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🎯 Offers:", offersAddress);
        console.log("🏪 DirectListingsExtension: (à réparer plus tard)");

        // Charger les ABIs
        console.log("\n📋 Chargement des ABIs...");
        
        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const OffersABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        ).abi;

        // Créer les instances des contrats
        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, wallet);
        const offers = new ethers.Contract(offersAddress, OffersABI, wallet);

        // ===== PHASE 1: VÉRIFICATION DES CONTRATS =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DES CONTRATS");
        console.log("=" .repeat(50));

        // Vérifier MarketplaceV3
        try {
            const marketplaceAdmin = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ MarketplaceV3 vérifié");
        } catch (error) {
            console.error("❌ Erreur avec MarketplaceV3:", error.message);
            process.exit(1);
        }

        // Vérifier Offers
        try {
            const offersAdmin = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ Offers vérifié");
        } catch (error) {
            console.error("❌ Erreur avec Offers:", error.message);
            process.exit(1);
        }

        // ===== PHASE 2: VÉRIFICATION DES PERMISSIONS =====
        console.log("\n🔐 PHASE 2: VÉRIFICATION DES PERMISSIONS");
        console.log("=" .repeat(50));

        const EXTENSION_ROLE = await marketplace.EXTENSION_ROLE();
        const hasExtensionRole = await marketplace.hasRole(EXTENSION_ROLE, wallet.address);

        if (!hasExtensionRole) {
            console.error("❌ Vous n'avez pas le rôle EXTENSION_ROLE sur la marketplace");
            console.log("💡 Contactez l'administrateur de la marketplace");
            process.exit(1);
        }

        console.log("✅ Permissions vérifiées (EXTENSION_ROLE)");

        // ===== PHASE 3: AJOUT DE L'EXTENSION OFFERS =====
        console.log("\n🔗 PHASE 3: AJOUT DE L'EXTENSION OFFERS");
        console.log("=" .repeat(50));

        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        console.log("🆔 ID de l'extension Offers:", OFFERS_ID);

        // Vérifier si l'extension est déjà enregistrée
        try {
            const existingOffers = await marketplace.getExtension(OFFERS_ID);
            if (existingOffers.extension !== ethers.ZeroAddress) {
                console.log("⚠️  Offers déjà enregistrée");
                console.log("   Adresse:", existingOffers.extension);
                console.log("   Activée:", existingOffers.enabled);
                console.log("   Nom:", existingOffers.name);
            } else {
                console.log("ℹ️  Offers non enregistrée, ajout en cours...");
            }
        } catch (error) {
            console.log("ℹ️  Offers non enregistrée, ajout en cours...");
        }

        // Ajouter l'extension Offers
        console.log("\n🎯 Enregistrement de l'extension Offers...");
        try {
            const tx = await marketplace.addExtension(
                OFFERS_ID,
                offersAddress,
                "Offers Extension"
            );
            
            console.log("⏳ Transaction envoyée:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ Extension Offers ajoutée avec succès !");
            console.log("   Block:", receipt.blockNumber);
            console.log("   Gas utilisé:", receipt.gasUsed.toString());
            
        } catch (error) {
            console.error("❌ Erreur lors de l'enregistrement de Offers:", error.message);
            process.exit(1);
        }

        // ===== PHASE 4: VÉRIFICATION FINALE =====
        console.log("\n✅ PHASE 4: VÉRIFICATION FINALE");
        console.log("=" .repeat(50));

        try {
            const offersExt = await marketplace.getExtension(OFFERS_ID);
            console.log("✅ Extension Offers vérifiée:");
            console.log("   Adresse:", offersExt.extension);
            console.log("   Activée:", offersExt.enabled);
            console.log("   Nom:", offersExt.name);
        } catch (error) {
            console.error("❌ Erreur lors de la vérification de Offers:", error.message);
        }

        // Lister toutes les extensions
        console.log("\n📋 Extensions enregistrées:");
        try {
            const allExtensionIds = await marketplace.getAllExtensionIds();
            for (const extensionId of allExtensionIds) {
                const extension = await marketplace.getExtension(extensionId);
                console.log(`   - ${extension.name}: ${extension.extension} (${extension.enabled ? 'Activée' : 'Désactivée'})`);
            }
        } catch (error) {
            console.error("❌ Erreur lors de la récupération des extensions:", error.message);
        }

        // ===== RÉSUMÉ FINAL =====
        console.log("\n🎉 LIAISON PARTIELLE RÉUSSIE !");
        console.log("=" .repeat(50));
        
        console.log("✅ Actions réussies:");
        console.log("   1. Extension Offers ajoutée à la marketplace");
        console.log("   2. Vérification des liaisons réussie");
        
        console.log("\n📍 État actuel:");
        console.log("   🏢 MarketplaceV3:", marketplaceAddress);
        console.log("   🎯 Offers:", offersAddress + " ✅ LIÉ");
        console.log("   🏪 DirectListingsExtension: (à réparer)");
        
        console.log("\n🚀 Prochaines étapes:");
        console.log("   1. Réparer DirectListingsExtension");
        console.log("   2. Lier DirectListingsExtension");
        console.log("   3. Tester toutes les fonctionnalités");
        
        console.log("\n💡 Avantages de cette approche:");
        console.log("   - Vous pouvez déjà utiliser les offres sur collection et tokens");
        console.log("   - La marketplace est partiellement fonctionnelle");
        console.log("   - Vous pouvez tester les nouvelles fonctionnalités d'Offers");

    } catch (error) {
        console.error("❌ Erreur lors de la liaison:", error.message);
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
    linkOffersOnly().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
