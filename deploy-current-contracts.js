#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function deployCurrentContracts() {
    console.log("🚀 DÉPLOIEMENT DES CONTRATS ACTUELS...");
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
            console.error("❌ Solde insuffisant pour le déploiement");
            process.exit(1);
        }

        // Charger les artifacts des contrats actuels
        console.log("\n📋 Chargement des contrats...");

        const MarketplaceV3Artifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        );

        const OffersArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/Offers.sol/Offers.json"), "utf8")
        );

        const DirectListingsArtifact = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/DirectListingsExtension.sol/DirectListingsExtension.json"), "utf8")
        );

        console.log("✅ Tous les artifacts chargés");

        // ===== PHASE 1: DÉPLOIEMENT DU MARKETPLACE =====
        console.log("\n🚀 PHASE 1: DÉPLOIEMENT DU MARKETPLACE");
        console.log("=" .repeat(50));

        // Configuration des paramètres du marketplace
        const nativeTokenWrapper = "0x5555555555555555555555555555555555555555";
        const platformFeeBps = 100; // 1%
        const platformFeeRecipient = wallet.address;
        const royaltyEngine = "0x0000000000000000000000000000000000000000";

        console.log("📝 Déploiement avec paramètres:");
        console.log("   Admin:", wallet.address);
        console.log("   Platform Fee:", platformFeeBps, "bps (", platformFeeBps/100, "%)");
        console.log("   Fee Recipient:", platformFeeRecipient);
        console.log("   Royalty Engine:", royaltyEngine);
        console.log("   Native Token Wrapper:", nativeTokenWrapper);

        const marketplaceFactory = new ethers.ContractFactory(
            MarketplaceV3Artifact.abi,
            MarketplaceV3Artifact.bytecode,
            wallet
        );

        console.log("🏗️  Déploiement en cours...");
        const marketplace = await marketplaceFactory.deploy(
            wallet.address,
            platformFeeBps,
            platformFeeRecipient,
            royaltyEngine,
            nativeTokenWrapper
        );

        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", marketplace.deploymentTransaction().hash);

        const marketplaceReceipt = await marketplace.waitForDeployment();
        const marketplaceAddress = await marketplace.getAddress();

        console.log("✅ MarketplaceV3 déployé avec succès !");
        console.log("   Adresse:", marketplaceAddress);
        console.log("   Block:", marketplaceReceipt.blockNumber);

        // ===== PHASE 2: DÉPLOIEMENT DES EXTENSIONS =====
        console.log("\n🚀 PHASE 2: DÉPLOIEMENT DES EXTENSIONS");
        console.log("=" .repeat(50));

        // Déploiement du contrat Offers
        console.log("\n🎯 Déploiement du contrat Offers...");
        const offersFactory = new ethers.ContractFactory(
            OffersArtifact.abi,
            OffersArtifact.bytecode,
            wallet
        );

        const offers = await offersFactory.deploy(wallet.address);
        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", offers.deploymentTransaction().hash);

        const offersReceipt = await offers.waitForDeployment();
        const offersAddress = await offers.getAddress();

        console.log("✅ Offers déployé avec succès !");
        console.log("   Adresse:", offersAddress);
        console.log("   Block:", offersReceipt.blockNumber);

        // Déploiement du contrat DirectListingsExtension
        console.log("\n📋 Déploiement du contrat DirectListingsExtension...");
        const directListingsFactory = new ethers.ContractFactory(
            DirectListingsArtifact.abi,
            DirectListingsArtifact.bytecode,
            wallet
        );

        const directListings = await directListingsFactory.deploy(nativeTokenWrapper, wallet.address);
        console.log("⏳ Déploiement en cours...");
        console.log("   Hash:", directListings.deploymentTransaction().hash);

        const directListingsReceipt = await directListings.waitForDeployment();
        const directListingsAddress = await directListings.getAddress();

        console.log("✅ DirectListingsExtension déployé avec succès !");
        console.log("   Adresse:", directListingsAddress);
        console.log("   Block:", directListingsReceipt.blockNumber);

        // ===== PHASE 3: AJOUT DES EXTENSIONS =====
        console.log("\n🔗 PHASE 3: AJOUT DES EXTENSIONS AU MARKETPLACE");
        console.log("=" .repeat(50));

        // Attendre un peu pour s'assurer que les contrats sont bien déployés
        console.log("⏳ Attente de la confirmation des déploiements...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Ajouter l'extension Offers
        console.log("\n🎯 Ajout de l'extension Offers...");
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        
        try {
            const addOffersTx = await marketplace.addExtension(
                OFFERS_ID,
                offersAddress,
                "Offers Extension"
            );
            console.log("⏳ Transaction envoyée, hash:", addOffersTx.hash);
            await addOffersTx.wait();
            console.log("✅ Extension Offers ajoutée avec succès !");
        } catch (error) {
            console.error("❌ Erreur lors de l'ajout de l'extension Offers:", error.message);
        }

        // Ajouter l'extension DirectListings
        console.log("\n📋 Ajout de l'extension DirectListings...");
        const DIRECTLISTINGS_ID = ethers.keccak256(ethers.toUtf8Bytes("DIRECTLISTINGS"));
        
        try {
            const addDirectListingsTx = await marketplace.addExtension(
                DIRECTLISTINGS_ID,
                directListingsAddress,
                "DirectListings Extension"
            );
            console.log("⏳ Transaction envoyée, hash:", addDirectListingsTx.hash);
            await addDirectListingsTx.wait();
            console.log("✅ Extension DirectListings ajoutée avec succès !");
        } catch (error) {
            console.error("❌ Erreur lors de l'ajout de l'extension DirectListings:", error.message);
        }

        // ===== PHASE 4: VÉRIFICATION FINALE =====
        console.log("\n🔍 PHASE 4: VÉRIFICATION FINALE");
        console.log("=" .repeat(50));

        try {
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions enregistrées:", allExtensions.length);
            
            for (const extId of allExtensions) {
                try {
                    const ext = await marketplace.getExtension(extId);
                    console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'}) - ${ext.name}`);
                } catch (error) {
                    console.log(`   - ${extId}: Erreur lors de la récupération`);
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification des extensions:", error.message);
        }

        // ===== PHASE 5: RÉSUMÉ FINAL =====
        console.log("\n🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !");
        console.log("=" .repeat(50));

        console.log("\n📍 ADRESSES DES CONTRATS:");
        console.log("🏢 MarketplaceV3:", marketplaceAddress);
        console.log("🎯 Offers:", offersAddress);
        console.log("📋 DirectListingsExtension:", directListingsAddress);

        console.log("\n💾 SAUVEGARDE DES ADRESSES:");
        console.log("💡 Ajoutez ces adresses à votre fichier .env ou de configuration");
        console.log("💡 Ces contrats sont maintenant prêts à être utilisés !");

    } catch (error) {
        console.error("❌ Erreur lors du déploiement:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    deployCurrentContracts().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
