#!/usr/bin/env node

import { ethers } from "ethers";

async function extractDeployedABI() {
    console.log("🔍 EXTRACTION DE L'ABI DU CONTRAT DÉPLOYÉ...");
    console.log("=" .repeat(60));

    // Configuration
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Adresse du contrat déployé
    const marketplaceAddress = "0xeEf91cD030F98Ce0330F050A446e3E883604D755";

    try {
        // Vérifier la connexion
        const network = await provider.getNetwork();
        console.log("🌐 Réseau:", network.name || "HyperEVM");
        console.log("🔗 Chain ID:", network.chainId);

        // Récupérer le code du contrat
        console.log("\n📋 Récupération du code du contrat...");
        const code = await provider.getCode(marketplaceAddress);
        
        if (code === "0x") {
            console.log("❌ Aucun code trouvé à cette adresse");
            return;
        }

        console.log("✅ Code du contrat trouvé");
        console.log("   Taille:", (code.length - 2) / 2, "bytes");

        // Essayer de récupérer les fonctions disponibles
        console.log("\n🔍 ANALYSE DES FONCTIONS DISPONIBLES...");
        console.log("=" .repeat(50));

        // Test des fonctions standard ERC165
        const erc165Interface = new ethers.Interface([
            "function supportsInterface(bytes4 interfaceId) view returns (bool)"
        ]);

        try {
            const supportsInterface = new ethers.Contract(marketplaceAddress, erc165Interface, provider);
            const result = await supportsInterface.supportsInterface("0x01ffc9a7"); // ERC165
            console.log("✅ ERC165 support:", result);
        } catch (error) {
            console.log("❌ ERC165 test échoue:", error.message);
        }

        // Test des fonctions AccessControl
        const accessControlInterface = new ethers.Interface([
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
            "function getRoleAdmin(bytes32 role) view returns (bytes32)",
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
            "function getRoleMemberCount(bytes32 role) view returns (uint256)"
        ]);

        try {
            const accessControl = new ethers.Contract(marketplaceAddress, accessControlInterface, provider);
            
            const adminRole = await accessControl.DEFAULT_ADMIN_ROLE();
            console.log("✅ DEFAULT_ADMIN_ROLE:", adminRole);
            
            const admin = await accessControl.getRoleMember(adminRole, 0);
            console.log("✅ Admin address:", admin);
            
        } catch (error) {
            console.log("❌ AccessControl test échoue:", error.message);
        }

        // Test des fonctions de base
        const baseInterface = new ethers.Interface([
            "function owner() view returns (address)",
            "function paused() view returns (bool)",
            "function pause()",
            "function unpause()"
        ]);

        try {
            const base = new ethers.Contract(marketplaceAddress, baseInterface, provider);
            
            try {
                const owner = await base.owner();
                console.log("✅ Owner:", owner);
            } catch (error) {
                console.log("❌ Owner function non disponible");
            }
            
            try {
                const paused = await base.paused();
                console.log("✅ Paused:", paused);
            } catch (error) {
                console.log("❌ Paused function non disponible");
            }
            
        } catch (error) {
            console.log("❌ Base functions test échoue:", error.message);
        }

        // Test des fonctions d'extension
        const extensionInterface = new ethers.Interface([
            "function addExtension(bytes32 _extensionId, address _extension, string _name)",
            "function getExtension(bytes32 _extensionId) view returns (address, bool, string)",
            "function getAllExtensionIds() view returns (bytes32[])",
            "function hasExtension(bytes32 _extensionId) view returns (bool)"
        ]);

        try {
            const extension = new ethers.Contract(marketplaceAddress, extensionInterface, provider);
            
            try {
                const allExtensions = await extension.getAllExtensionIds();
                console.log("✅ getAllExtensionIds:", allExtensions);
            } catch (error) {
                console.log("❌ getAllExtensionIds non disponible:", error.message);
            }
            
        } catch (error) {
            console.log("❌ Extension functions test échoue:", error.message);
        }

        // Test des fonctions de marketplace
        const marketplaceInterface = new ethers.Interface([
            "function platformFee() view returns (uint16, address)",
            "function royaltyEngine() view returns (address)",
            "function nativeTokenWrapper() view returns (address)"
        ]);

        try {
            const marketplace = new ethers.Contract(marketplaceAddress, marketplaceInterface, provider);
            
            try {
                const platformFee = await marketplace.platformFee();
                console.log("✅ Platform Fee:", platformFee);
            } catch (error) {
                console.log("❌ Platform Fee non disponible");
            }
            
            try {
                const royaltyEngine = await marketplace.royaltyEngine();
                console.log("✅ Royalty Engine:", royaltyEngine);
            } catch (error) {
                console.log("❌ Royalty Engine non disponible");
            }
            
        } catch (error) {
            console.log("❌ Marketplace functions test échoue:", error.message);
        }

        console.log("\n💡 ANALYSE:");
        console.log("   - Le contrat a du code mais les fonctions ne correspondent pas à votre ABI");
        console.log("   - Il s'agit probablement d'une version différente ou d'un autre contrat");
        console.log("   - Vous devrez soit redéployer, soit adapter votre code à ce contrat");

    } catch (error) {
        console.error("❌ Erreur lors de l'analyse:", error.message);
    }
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
    extractDeployedABI().catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    });
}
