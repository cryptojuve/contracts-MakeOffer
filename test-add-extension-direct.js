#!/usr/bin/env node

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testAddExtensionDirect() {
    console.log("🧪 TEST DIRECT D'ADDEXTENSION AVEC TRANSACTION...");
    console.log("=" .repeat(70));

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

    // Adresses des contrats
    const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";
    const offersAddress = "0x5eF000e2a094970B59d089aE01649B3B5908f9c8";

    console.log("📍 Adresses des Contrats:");
    console.log("🏢 MarketplaceV3:", marketplaceAddress);
    console.log("🎯 Offers:", offersAddress);
    console.log("📱 Déployeur:", wallet.address);

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // Vérifier le solde
        const balance = await provider.getBalance(wallet.address);
        console.log("💰 Solde:", ethers.formatEther(balance), "HYPE");

        // Charger l'ABI de la marketplace
        console.log("\n📋 Chargement de l'ABI MarketplaceV3...");
        const MarketplaceV3ABI = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3.sol/MarketplaceV3.json"), "utf8")
        ).abi;

        const marketplace = new ethers.Contract(marketplaceAddress, MarketplaceV3ABI, wallet);

        // ===== PHASE 1: VÉRIFICATION DES RÔLES =====
        console.log("\n🔍 PHASE 1: VÉRIFICATION DES RÔLES");
        console.log("=" .repeat(50));

        try {
            const adminRole = await marketplace.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
        } catch (error) {
            console.error("❌ DEFAULT_ADMIN_ROLE échoue:", error.message);
        }

        let extensionRole;
        try {
            extensionRole = await marketplace.EXTENSION_ROLE();
            console.log("✅ EXTENSION_ROLE:", extensionRole);
        } catch (error) {
            console.error("❌ EXTENSION_ROLE échoue:", error.message);
            return;
        }

        // Vérifier si le wallet a le rôle EXTENSION_ROLE
        try {
            const hasRole = await marketplace.hasRole(extensionRole, wallet.address);
            console.log("🔑 Wallet a le rôle EXTENSION_ROLE:", hasRole);
            
            if (!hasRole) {
                console.log("⚠️  Le wallet n'a pas le rôle EXTENSION_ROLE");
                console.log("💡 Vérifiez que le wallet est bien l'admin du contrat");
                return;
            }
        } catch (error) {
            console.error("❌ Erreur lors de la vérification du rôle:", error.message);
            return;
        }

        // ===== PHASE 2: TEST D'ADDEXTENSION =====
        console.log("\n🧪 PHASE 2: TEST D'ADDEXTENSION");
        console.log("=" .repeat(50));

        const OFFERS_ID = ethers.keccak256(ethers.toUtf8Bytes("OFFERS"));
        console.log("🆔 ID de l'extension Offers:", OFFERS_ID);

        // Vérifier si l'extension existe déjà
        try {
            const existingExtension = await marketplace.getExtension(OFFERS_ID);
            if (existingExtension.extension !== ethers.ZeroAddress) {
                console.log("⚠️  Extension déjà enregistrée:");
                console.log("   Adresse:", existingExtension.extension);
                console.log("   Activée:", existingExtension.enabled);
                console.log("   Nom:", existingExtension.name);
                
                if (existingExtension.extension === offersAddress) {
                    console.log("✅ L'extension est déjà correctement enregistrée");
                    return;
                } else {
                    console.log("⚠️  L'extension est enregistrée avec une adresse différente");
                }
            } else {
                console.log("ℹ️  Extension non enregistrée, on peut l'ajouter");
            }
        } catch (error) {
            console.log("ℹ️  Extension non enregistrée (erreur lors de la vérification)");
        }

        // Test d'estimation de gas
        console.log("\n🧪 Test d'estimation de gas...");
        try {
            const gasEstimate = await marketplace.addExtension.estimateGas(
                OFFERS_ID,
                offersAddress,
                "Offers Extension"
            );
            console.log("✅ Estimation de gas réussie:", gasEstimate.toString());
        } catch (error) {
            console.error("❌ Estimation de gas échoue:", error.message);
            console.log("💡 Cela peut indiquer un problème avec les paramètres ou la logique du contrat");
            return;
        }

        // Test d'exécution de la transaction
        console.log("\n🧪 Test d'exécution de la transaction...");
        try {
            console.log("📝 Envoi de la transaction addExtension...");
            
            const tx = await marketplace.addExtension(
                OFFERS_ID,
                offersAddress,
                "Offers Extension",
                {
                    gasLimit: 200000 // Limite de gas fixe pour éviter les problèmes
                }
            );
            
            console.log("⏳ Transaction envoyée, hash:", tx.hash);
            console.log("⏳ Attente de la confirmation...");
            
            const receipt = await tx.wait();
            console.log("✅ Transaction confirmée !");
            console.log("   Block:", receipt.blockNumber);
            console.log("   Gas utilisé:", receipt.gasUsed.toString());
            
            // Vérifier que l'extension a été ajoutée
            console.log("\n🔍 Vérification de l'ajout de l'extension...");
            const newExtension = await marketplace.getExtension(OFFERS_ID);
            console.log("✅ Extension ajoutée avec succès:");
            console.log("   Adresse:", newExtension.extension);
            console.log("   Activée:", newExtension.enabled);
            console.log("   Nom:", newExtension.name);
            
        } catch (error) {
            console.error("❌ Exécution de la transaction échoue:", error.message);
            
            if (error.message.includes("insufficient funds")) {
                console.log("💡 Problème de solde insuffisant");
            } else if (error.message.includes("gas required exceeds allowance")) {
                console.log("💡 Problème de gas insuffisant");
            } else if (error.message.includes("execution reverted")) {
                console.log("💡 Transaction revertée - problème dans la logique du contrat");
            }
        }

    } catch (error) {
        console.error("❌ Erreur lors du test:", error.message);
        process.exit(1);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    testAddExtensionDirect().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
