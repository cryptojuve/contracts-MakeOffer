#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function linkExtensions() {
    console.log("🔗 Liaison des Extensions à la Marketplace...");

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

        if (balance === 0n) {
            console.error("❌ Solde insuffisant pour les transactions");
            process.exit(1);
        }

        // Charger les ABIs des contrats
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

        // Demander les adresses des contrats déployés
        console.log("\n📝 Configuration des Adresses de Contrats:");
        console.log("💡 Entrez les adresses des contrats déjà déployés");

        const marketplaceAddress = process.env.MARKETPLACE_ADDRESS || await askForAddress("MarketplaceV3");
        const directListingsAddress = process.env.DIRECTLISTINGS_ADDRESS || await askForAddress("DirectListingsExtension");
        const offersAddress = process.env.OFFERS_ADDRESS || await askForAddress("Offers");

        console.log("\n📍 Adresses des Contrats:");
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🏪 DirectListingsExtension:", directListingsAddress);
        console.log("🎯 Offers:", offersAddress);

        // Créer les instances des contrats
        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, wallet);
        const directListings = new ethers.Contract(directListingsAddress, DirectListingsExtensionABI, wallet);
        const offers = new ethers.Contract(offersAddress, OffersABI, wallet);

        // Vérifier que les contrats existent
        console.log("\n🔍 Vérification des contrats...");

        try {
            const marketplaceAdmin = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ MarketplaceV3 vérifié");
        } catch (error) {
            console.error("❌ Erreur avec MarketplaceV3:", error.message);
            process.exit(1);
        }

        try {
            const directListingsAdmin = await directListings.DEFAULT_ADMIN_ROLE();
            console.log("✅ DirectListingsExtension vérifié");
        } catch (error) {
            console.error("❌ Erreur avec DirectListingsExtension:", error.message);
            process.exit(1);
        }

        try {
            const offersAdmin = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ Offers vérifié");
        } catch (error) {
            console.error("❌ Erreur avec Offers:", error.message);
            process.exit(1);
        }

        // Vérifier les permissions sur la marketplace
        console.log("\n🔐 Vérification des permissions...");

        const EXTENSION_ROLE = await marketplace.EXTENSION_ROLE();
        const hasExtensionRole = await marketplace.hasRole(EXTENSION_ROLE, wallet.address);

        if (!hasExtensionRole) {
            console.error("❌ Vous n'avez pas le rôle EXTENSION_ROLE sur la marketplace");
            console.log("💡 Contactez l'administrateur de la marketplace");
            process.exit(1);
        }

        console.log("✅ Permissions vérifiées (EXTENSION_ROLE)");

        // Définir les IDs des extensions
        const DIRECT_LISTINGS_ID = ethers.keccak256(ethers.toUtf8Bytes("DIRECT_LISTINGS"));
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));

        console.log("\n🆔 IDs des Extensions:");
        console.log("DIRECT_LISTINGS:", DIRECT_LISTINGS_ID);
        console.log("OFFERS:", OFFERS_ID);

        // Vérifier si les extensions sont déjà enregistrées
        console.log("\n🔍 Vérification des extensions existantes...");

        try {
            const existingDirectListings = await marketplace.getExtension(DIRECT_LISTINGS_ID);
            if (existingDirectListings.extension !== ethers.ZeroAddress) {
                console.log("⚠️  DirectListingsExtension déjà enregistrée");
                console.log("   Adresse:", existingDirectListings.extension);
                console.log("   Activée:", existingDirectListings.enabled);
            } else {
                console.log("ℹ️  DirectListingsExtension non enregistrée");
            }
        } catch (error) {
            console.log("ℹ️  DirectListingsExtension non enregistrée");
        }

        try {
            const existingOffers = await marketplace.getExtension(OFFERS_ID);
            if (existingOffers.extension !== ethers.ZeroAddress) {
                console.log("⚠️  Offers déjà enregistrée");
                console.log("   Adresse:", existingOffers.extension);
                console.log("   Activée:", existingOffers.enabled);
            } else {
                console.log("ℹ️  Offers non enregistrée");
            }
        } catch (error) {
            console.log("ℹ️  Offers non enregistrée");
        }

        // Demander confirmation
        console.log("\n⚠️  ATTENTION: Cette opération va lier les extensions à la marketplace");
        console.log("📋 Actions qui seront effectuées:");
        console.log("   1. Enregistrer DirectListingsExtension");
        console.log("   2. Enregistrer Offers");
        console.log("   3. Vérifier les liaisons");

        const confirm = process.env.CONFIRM || await askForConfirmation("Continuer ? (oui/non)");
        if (confirm.toLowerCase() !== 'oui' && confirm.toLowerCase() !== 'yes') {
            console.log("❌ Opération annulée");
            process.exit(0);
        }

        // Enregistrer DirectListingsExtension
        console.log("\n🏪 Enregistrement de DirectListingsExtension...");
        try {
            const tx1 = await marketplace.addExtension(
                DIRECT_LISTINGS_ID,
                directListingsAddress,
                "Direct Listings Extension"
            );
            console.log("⏳ Transaction envoyée:", tx1.hash);
            await tx1.wait();
            console.log("✅ DirectListingsExtension enregistrée avec succès");
        } catch (error) {
            console.error("❌ Erreur lors de l'enregistrement de DirectListingsExtension:", error.message);
            process.exit(1);
        }

        // Enregistrer Offers
        console.log("\n🎯 Enregistrement de Offers...");
        try {
            const tx2 = await marketplace.addExtension(
                OFFERS_ID,
                offersAddress,
                "Offers Extension"
            );
            console.log("⏳ Transaction envoyée:", tx2.hash);
            await tx2.wait();
            console.log("✅ Offers enregistrée avec succès");
        } catch (error) {
            console.error("❌ Erreur lors de l'enregistrement de Offers:", error.message);
            process.exit(1);
        }

        // Vérifier les liaisons
        console.log("\n🔍 Vérification des liaisons...");

        try {
            const directListingsExt = await marketplace.getExtension(DIRECT_LISTINGS_ID);
            console.log("✅ DirectListingsExtension vérifiée:");
            console.log("   Adresse:", directListingsExt.extension);
            console.log("   Activée:", directListingsExt.enabled);
            console.log("   Nom:", directListingsExt.name);
        } catch (error) {
            console.error("❌ Erreur lors de la vérification de DirectListingsExtension:", error.message);
        }

        try {
            const offersExt = await marketplace.getExtension(OFFERS_ID);
            console.log("✅ Offers vérifiée:");
            console.log("   Adresse:", offersExt.extension);
            console.log("   Activée:", offersExt.enabled);
            console.log("   Nom:", offersExt.name);
        } catch (error) {
            console.error("❌ Erreur lors de la vérification de Offers:", error.message);
        }

        // Lister toutes les extensions
        console.log("\n📋 Toutes les extensions enregistrées:");
        try {
            const allExtensionIds = await marketplace.getAllExtensionIds();
            for (const extensionId of allExtensionIds) {
                const extension = await marketplace.getExtension(extensionId);
                console.log(`   - ${extension.name}: ${extension.extension} (${extension.enabled ? 'Activée' : 'Désactivée'})`);
            }
        } catch (error) {
            console.error("❌ Erreur lors de la récupération des extensions:", error.message);
        }

        console.log("\n🎉 Liaison des extensions terminée avec succès !");
        console.log("\n📊 Résumé:");
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🏪 DirectListingsExtension:", directListingsAddress);
        console.log("🎯 Offers:", offersAddress);
        console.log("\n🔗 Les extensions sont maintenant liées et opérationnelles !");

    } catch (error) {
        console.error("❌ Erreur lors de la liaison des extensions:", error.message);
        process.exit(1);
    }
}

// Fonction utilitaire pour demander une adresse
async function askForAddress(contractName) {
    // En mode non-interactif, utiliser une adresse par défaut
    if (process.env.NODE_ENV === 'production') {
        return "0x0000000000000000000000000000000000000000";
    }

    // En mode interactif, demander à l'utilisateur
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`Entrez l'adresse de ${contractName}: `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Fonction utilitaire pour demander confirmation
async function askForConfirmation(message) {
    if (process.env.NODE_ENV === 'production') {
        return 'oui';
    }

    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
    console.error("❌ Erreur non capturée:", error);
    process.exit(1);
});

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    linkExtensions().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
