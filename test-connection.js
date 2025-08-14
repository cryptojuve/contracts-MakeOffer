import { ethers } from "ethers";

async function testConnection() {
    console.log("🔍 Testing HyperEVM Connection...");

    // URL RPC HyperEVM (à configurer selon votre réseau)
    const rpcUrl = "https://999.rpc.thirdweb.com"; // ou votre URL spécifique

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Test de connexion
        const network = await provider.getNetwork();
        console.log("✅ Connected to network:", network.name);
        console.log("🔗 Chain ID:", network.chainId);

        // Test de récupération du dernier bloc
        const latestBlock = await provider.getBlock("latest");
        console.log("📦 Latest block number:", latestBlock.number);
        console.log("⛽ Block gas limit:", latestBlock.gasLimit.toString());
        console.log("💰 Block base fee:", latestBlock.baseFeePerGas?.toString() || "N/A");

        // Test de récupération du solde d'un compte
        const testAddress = "0x0000000000000000000000000000000000000000";
        const balance = await provider.getBalance(testAddress);
        console.log("💎 Balance of zero address:", ethers.formatEther(balance), "HYPE");

        console.log("\n🎉 Connection test successful!");

    } catch (error) {
        console.error("❌ Connection failed:", error.message);

        if (error.message.includes("gas limit")) {
            console.log("\n💡 Gas limit issue detected!");
            console.log("🔧 Solutions:");
            console.log("1. Check if HyperEVM has sufficient gas limit");
            console.log("2. Optimize contract size");
            console.log("3. Use a different deployment strategy");
        }
    }
}

testConnection().catch(console.error);
