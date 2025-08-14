// Configuration pour le script de liaison des extensions
export const config = {
    // Réseau
    network: {
        rpcUrl: process.env.HYPEREVM_RPC_URL || "https://999.rpc.thirdweb.com",
        chainId: 999,
        name: "HyperEVM"
    },

    // Adresses des contrats (à remplir après déploiement)
    contracts: {
        marketplace: process.env.MARKETPLACE_ADDRESS || "0xeEf91cD030F98Ce0330F050A446e3E883604D755",
        directListings: process.env.DIRECTLISTINGS_ADDRESS || "0x0D180f0029679BEDe5d9516f3b089BfD8d9cfd32",
        offers: process.env.OFFERS_ADDRESS || "0x97541DFbe88427F02400F0Efb7d0679C32C76d0e"
    },

    // Configuration des extensions
    extensions: {
        directListings: {
            id: "DIRECT_LISTINGS",
            name: "Direct Listings Extension",
            description: "Gestion des ventes directes de NFTs"
        },
        offers: {
            id: "OFFERS",
            name: "Offers Extension",
            description: "Gestion des offres d'achat de NFTs"
        }
    },

    // Paramètres de transaction
    transaction: {
        gasLimit: 500000,
        maxFeePerGas: "2000000000", // 2 Gwei
        maxPriorityFeePerGas: "1000000000" // 1 Gwei
    },

    // Logs et verbosité
    logging: {
        verbose: process.env.VERBOSE === 'true',
        showGas: true,
        showEvents: true
    }
};

// Fonction pour valider la configuration
export function validateConfig() {
    const errors = [];

    if (!config.contracts.marketplace) {
        errors.push("MARKETPLACE_ADDRESS non définie");
    }

    if (!config.contracts.directListings) {
        errors.push("DIRECTLISTINGS_ADDRESS non définie");
    }

    if (!config.contracts.offers) {
        errors.push("OFFERS_ADDRESS non définie");
    }

    if (errors.length > 0) {
        throw new Error(`Configuration invalide: ${errors.join(', ')}`);
    }

    return true;
}

// Fonction pour afficher la configuration
export function displayConfig() {
    console.log("📋 Configuration actuelle:");
    console.log("🌐 Réseau:", config.network.name);
    console.log("🔗 RPC:", config.network.rpcUrl);
    console.log("🏢 Marketplace:", config.contracts.marketplace || "Non définie");
    console.log("🏪 DirectListings:", config.contracts.directListings || "Non définie");
    console.log("🎯 Offers:", config.contracts.offers || "Non définie");
    console.log("📝 Extensions à lier:", Object.keys(config.extensions).length);
}

export default config;
