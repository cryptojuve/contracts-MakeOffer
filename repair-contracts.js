#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function repairContracts() {
    console.log("🔧 RÉPARATION DES CONTRATS DÉPLOYÉS...");
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
            console.error("❌ Solde insuffisant pour les transactions de réparation");
            process.exit(1);
        }

        // Adresses des contrats
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

        // ===== PHASE 1: DIAGNOSTIC APPROFONDI =====
        console.log("\n🔍 PHASE 1: DIAGNOSTIC APPROFONDI");
        console.log("=" .repeat(50));

        // Vérifier le code des contrats
        const directListingsCode = await provider.getCode(directListingsAddress);
        const offersCode = await provider.getCode(offersAddress);

        if (directListingsCode === "0x") {
            console.error("❌ DirectListingsExtension n'a pas de code (contrat non déployé)");
            process.exit(1);
        }

        if (offersCode === "0x") {
            console.error("❌ Offers n'a pas de code (contrat non déployé)");
            process.exit(1);
        }

        console.log("✅ DirectListingsExtension a du code");
        console.log("✅ Offers a du code");

        // ===== PHASE 2: RÉPARATION DES CONTRATS =====
        console.log("\n🔧 PHASE 2: RÉPARATION DES CONTRATS");
        console.log("=" .repeat(50));

        // Essayer de réparer DirectListingsExtension
        console.log("\n🏪 Réparation de DirectListingsExtension...");
        
        try {
            // Vérifier si le contrat a un admin
            const directListingsAdminRole = await directListings.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", directListingsAdminRole);
            
            const hasDirectListingsAdmin = await directListings.hasRole(directListingsAdminRole, wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasDirectListingsAdmin);
            
            if (!hasDirectListingsAdmin) {
                console.log("⚠️  Tentative de récupération du rôle admin...");
                // Essayer d'appeler des fonctions qui pourraient révéler le problème
                try {
                    const totalListings = await directListings.totalListings();
                    console.log("✅ Total Listings:", totalListings.toString());
                } catch (error) {
                    console.log("❌ Erreur totalListings:", error.message);
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification DirectListings:", error.message);
        }

        // Essayer de réparer Offers
        console.log("\n🎯 Réparation de Offers...");
        
        try {
            const offersAdminRole = await offers.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", offersAdminRole);
            
            const hasOffersAdmin = await offers.hasRole(offersAdminRole, wallet.address);
            console.log("✅ Déployeur a DEFAULT_ADMIN_ROLE:", hasOffersAdmin);
            
            if (!hasOffersAdmin) {
                console.log("⚠️  Tentative de récupération du rôle admin...");
                try {
                    const totalOffers = await offers.totalOffers();
                    console.log("✅ Total Offers:", totalOffers.toString());
                } catch (error) {
                    console.log("❌ Erreur totalOffers:", error.message);
                }
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification Offers:", error.message);
        }

        // ===== PHASE 3: TEST DE RÉPARATION =====
        console.log("\n🧪 PHASE 3: TEST DE RÉPARATION");
        console.log("=" .repeat(50));

        // Tester si les contrats répondent maintenant
        console.log("\n🧪 Test de réponse des contrats...");
        
        try {
            const directListingsTotal = await directListings.totalListings();
            console.log("✅ DirectListings totalListings:", directListingsTotal.toString());
        } catch (error) {
            console.log("❌ DirectListings totalListings toujours en erreur:", error.message);
        }

        try {
            const offersTotal = await offers.totalOffers();
            console.log("✅ Offers totalOffers:", offersTotal.toString());
        } catch (error) {
            console.log("❌ Offers totalOffers toujours en erreur:", error.message);
        }

        // ===== PHASE 4: TENTATIVE D'AJOUT D'EXTENSION =====
        console.log("\n🔗 PHASE 4: TENTATIVE D'AJOUT D'EXTENSION");
        console.log("=" .repeat(50));

        const DIRECT_LISTINGS_ID = ethers.keccak256(ethers.toUtf8Bytes("DIRECT_LISTINGS"));
        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));

        console.log("🆔 IDs des Extensions:");
        console.log("DIRECT_LISTINGS:", DIRECT_LISTINGS_ID);
        console.log("OFFERS:", OFFERS_ID);

        // Tester l'ajout d'extension avec gestion d'erreur détaillée
        console.log("\n🧪 Test d'ajout d'extension DirectListings...");
        
        try {
            // Essayer d'estimer le gas d'abord
            const gasEstimate = await marketplace.addExtension.estimateGas(
                DIRECT_LISTINGS_ID,
                directListingsAddress,
                "Direct Listings Extension"
            );
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());
            
            // Si l'estimation réussit, essayer l'ajout
            console.log("🚀 Tentative d'ajout de l'extension...");
            const tx = await marketplace.addExtension(
                DIRECT_LISTINGS_ID,
                directListingsAddress,
                "Direct Listings Extension",
                { gasLimit: gasEstimate + 50000n } // Ajouter une marge
            );
            
            console.log("⏳ Transaction envoyée:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ Extension DirectListings ajoutée avec succès !");
            console.log("   Block:", receipt.blockNumber);
            console.log("   Gas utilisé:", receipt.gasUsed.toString());
            
        } catch (error) {
            console.error("❌ Erreur lors de l'ajout DirectListings:", error.message);
            
            // Analyser l'erreur plus en détail
            if (error.code === 'CALL_EXCEPTION') {
                console.log("💡 Erreur de contrat - vérifiez les permissions et l'état");
            } else if (error.code === 'INSUFFICIENT_FUNDS') {
                console.log("💡 Fonds insuffisants");
            } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                console.log("💡 Limite de gas imprévisible - problème de contrat");
            }
        }

        // ===== PHASE 5: VÉRIFICATION FINALE =====
        console.log("\n✅ PHASE 5: VÉRIFICATION FINALE");
        console.log("=" .repeat(50));

        try {
            const allExtensions = await marketplace.getAllExtensionIds();
            console.log("✅ Extensions enregistrées:", allExtensions.length);
            
            for (const extId of allExtensions) {
                try {
                    const ext = await marketplace.getExtension(extId);
                    console.log(`   - ${extId}: ${ext.extension} (${ext.enabled ? 'Activée' : 'Désactivée'})`);
                } catch (error) {
                    console.log(`   - ${extId}: Erreur lors de la récupération`);
                }
            }
        } catch (error) {
            console.log("❌ Impossible de récupérer les extensions:", error.message);
        }

        // ===== RÉSUMÉ ET RECOMMANDATIONS =====
        console.log("\n📊 RÉSUMÉ DE LA RÉPARATION");
        console.log("=" .repeat(50));
        
        console.log("🔧 Actions effectuées:");
        console.log("   1. ✅ Diagnostic approfondi des contrats");
        console.log("   2. ✅ Vérification des permissions");
        console.log("   3. ✅ Test de réparation");
        console.log("   4. ✅ Tentative d'ajout d'extension");
        console.log("   5. ✅ Vérification finale");
        
        console.log("\n💡 Recommandations:");
        console.log("   - Si les erreurs persistent, les contrats peuvent nécessiter un redéploiement");
        console.log("   - Vérifiez que les contrats ont été déployés avec les bons paramètres");
        console.log("   - Assurez-vous que les constructeurs ont été appelés correctement");
        
        console.log("\n🎯 Prochaines étapes:");
        console.log("   1. Vérifiez les logs de déploiement");
        console.log("   2. Si nécessaire, redéployez les contrats");
        console.log("   3. Relancez le script link-extensions.js");

    } catch (error) {
        console.error("❌ Erreur lors de la réparation:", error.message);
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
    repairContracts().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
