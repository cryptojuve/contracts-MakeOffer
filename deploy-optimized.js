import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Obtenir le chemin du répertoire courant
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    console.log("🚀 Deploying OpenZeppelin Contracts (Optimized)...");
    const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x1318247500f31e76ec35b2c19d3cbb1256a6365bcbb8338d4986d677d4e85e28";

    // Configuration du provider et du wallet
    const rpcUrl = process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("📱 Deployer address:", wallet.address);
    console.log("🔗 RPC URL:", rpcUrl);

    try {
        // Test de connexion
        const network = await provider.getNetwork();
        console.log("🔗 Network:", network.name || "Unknown");
        console.log("🔗 Chain ID:", network.chainId);

        // Récupération des informations du bloc
        const latestBlock = await provider.getBlock("latest");
        console.log("📦 Latest block:", latestBlock.number);
        console.log("⛽ Block gas limit:", latestBlock.gasLimit.toString());

        // Configuration des paramètres de gas (ethers v6 syntax)
        const gasLimit = latestBlock.gasLimit;
        const maxGasLimit = (gasLimit * 80n) / 100n; // 80% de la limite du bloc

        console.log("⛽ Max gas per transaction:", maxGasLimit.toString());

        // Lecture des artifacts JSON
        const DirectListingsExtension = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/DirectListingsExtensionOpenZeppelin.sol/DirectListingsExtension.json"), "utf8")
        );
        const OffersOpenZeppelin = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/OffersOpenZeppelin.sol/OffersOpenZeppelin.json"), "utf8")
        );
        const MarketplaceV3OpenZeppelin = JSON.parse(
            readFileSync(join(__dirname, "./artifacts_forge/MarketplaceV3OpenZeppelin.sol/MarketplaceV3OpenZeppelin.json"), "utf8")
        );

        // Configuration des paramètres
        const nativeTokenWrapper = "0x5555555555555555555555555555555555555555";
        const platformFeeBps = 100; // 1%
        const platformFeeRecipient = wallet.address;
        const royaltyEngine = "0x0000000000000000000000000000000000000000";

        console.log("\n🏗️  Deploying contracts with optimized gas settings...");

        // 1. Déploiement du MarketplaceV3 (le plus gros contrat)
        console.log("\n1️⃣ Deploying MarketplaceV3OpenZeppelin...");
        const marketplaceFactory = new ethers.ContractFactory(
            MarketplaceV3OpenZeppelin.abi,
            MarketplaceV3OpenZeppelin.bytecode,
            wallet
        );

        // Estimation du gas avec gestion d'erreur
        let marketplaceGasEstimate;
        try {
            const deployTx = await marketplaceFactory.getDeployTransaction(
                wallet.address,
                platformFeeBps,
                platformFeeRecipient,
                royaltyEngine,
                nativeTokenWrapper
            );
            marketplaceGasEstimate = deployTx.gasLimit;
            console.log("⛽ Estimated gas for MarketplaceV3:", marketplaceGasEstimate?.toString() || "Unknown");
        } catch (error) {
            console.log("⚠️  Could not estimate gas, using default limit");
            marketplaceGasEstimate = maxGasLimit;
        }

        // Déclarer la variable marketplace
        let marketplace;

        // Vérification et déploiement
        if (marketplaceGasEstimate && marketplaceGasEstimate > maxGasLimit) {
            console.log("⚠️  Gas estimate exceeds block limit!");
            console.log("🔧 Trying to deploy with custom gas limit...");

            // Déploiement avec gas limit personnalisé
            marketplace = await marketplaceFactory.deploy(
                wallet.address,
                platformFeeBps,
                platformFeeRecipient,
                royaltyEngine,
                nativeTokenWrapper,
                {
                    gasLimit: maxGasLimit
                }
            );

            console.log("⏳ Waiting for deployment...");
            // En ethers v6, on attend que la transaction soit confirmée
            await marketplace.waitForDeployment();
            console.log("✅ MarketplaceV3OpenZeppelin deployed at:", await marketplace.getAddress());

        } else {
            // Déploiement normal
            marketplace = await marketplaceFactory.deploy(
                wallet.address,
                platformFeeBps,
                platformFeeRecipient,
                royaltyEngine,
                nativeTokenWrapper
            );

            await marketplace.waitForDeployment();
            console.log("✅ MarketplaceV3OpenZeppelin deployed at:", await marketplace.getAddress());
        }

        // 2. Déploiement du DirectListingsExtension
        console.log("\n2️⃣ Deploying DirectListingsExtensionOpenZeppelin...");
        const directListingsFactory = new ethers.ContractFactory(
            DirectListingsExtension.abi,
            DirectListingsExtension.bytecode,
            wallet
        );

        const directListings = await directListingsFactory.deploy(
            nativeTokenWrapper,
            wallet.address
        );

        await directListings.waitForDeployment();
        console.log("✅ DirectListingsExtensionOpenZeppelin deployed at:", await directListings.getAddress());

        // 3. Déploiement du OffersOpenZeppelin
        console.log("\n3️⃣ Deploying OffersOpenZeppelin...");
        const offersFactory = new ethers.ContractFactory(
            OffersOpenZeppelin.abi,
            OffersOpenZeppelin.bytecode,
            wallet
        );

        const offers = await offersFactory.deploy(
            wallet.address,
            platformFeeBps,
            platformFeeRecipient
        );

        await offers.waitForDeployment();
        console.log("✅ OffersOpenZeppelin deployed at:", await offers.getAddress());

        console.log("\n🎉 All contracts deployed successfully!");
        console.log("\n📋 Contract Addresses:");
        console.log("MarketplaceV3OpenZeppelin:", await marketplace.getAddress());
        console.log("DirectListingsExtensionOpenZeppelin:", await directListings.getAddress());
        console.log("OffersOpenZeppelin:", await offers.getAddress());

    } catch (error) {
        console.error("❌ Deployment failed:", error.message);

        if (error.message.includes("gas limit")) {
            console.log("\n💡 Gas limit solution:");
            console.log("1. Check HyperEVM configuration");
            console.log("2. Consider deploying contracts separately");
            console.log("3. Optimize contract size");
        }

        process.exit(1);
    }
}

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

main().catch((error) => {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
});
