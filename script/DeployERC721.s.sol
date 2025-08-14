// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ERC721Collection.sol";

/**
 * @title DeployERC721
 * @dev Script de déploiement pour ERC721Collection
 */
contract DeployERC721 is Script {
    // Paramètres de déploiement
    string constant NAME = "testnetscratch";
    string constant SYMBOL = "TNS";
    uint256 constant MAX_SUPPLY = 10_000; // 10,000 NFTs maximum
    uint256 constant MINT_PRICE = 0.01 ether; // 0.01 HYPE par NFT (token natif HyperEVM)
    uint256 constant MAX_MINT_PER_WALLET = 10; // Maximum 10 NFTs par wallet
    uint256 constant MAX_MINT_PER_TRANSACTION = 5; // Maximum 5 NFTs par transaction

    function run() external {
        // Récupération de la clé privée depuis l'environnement
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploiement de ERC721Collection...");
        console.log("Deploiement avec le compte:", deployer);
        console.log("Balance du compte:", deployer.balance);

        console.log("\nParametres de deploiement:");
        console.log("   Nom:", NAME);
        console.log("   Symbole:", SYMBOL);
        console.log("   Supply maximale:", MAX_SUPPLY);
        console.log("   Prix de mint:", MINT_PRICE);
        console.log("   Max par wallet:", MAX_MINT_PER_WALLET);
        console.log("   Max par transaction:", MAX_MINT_PER_TRANSACTION);
        console.log("   Admin:", deployer);

        // Démarrage du broadcast
        vm.startBroadcast(deployerPrivateKey);

        // Déploiement du contrat
        ERC721Collection collection = new ERC721Collection(
            NAME,
            SYMBOL,
            MAX_SUPPLY,
            MINT_PRICE,
            MAX_MINT_PER_WALLET,
            MAX_MINT_PER_TRANSACTION,
            deployer
        );

        vm.stopBroadcast();

        console.log("\nERC721Collection deploye avec succes!");
        console.log("Adresse du contrat:", address(collection));

        // Vérification des rôles
        console.log("\nVerification des roles...");
        
        bytes32 DEFAULT_ADMIN_ROLE = collection.DEFAULT_ADMIN_ROLE();
        bytes32 MINTER_ROLE = collection.MINTER_ROLE();
        bytes32 BURNER_ROLE = collection.BURNER_ROLE();
        bytes32 METADATA_ROLE = collection.METADATA_ROLE();

        console.log("   DEFAULT_ADMIN_ROLE:", vm.toString(DEFAULT_ADMIN_ROLE));
        console.log("   MINTER_ROLE:", vm.toString(MINTER_ROLE));
        console.log("   BURNER_ROLE:", vm.toString(BURNER_ROLE));
        console.log("   METADATA_ROLE:", vm.toString(METADATA_ROLE));

        // Vérification que le déployeur a tous les rôles
        bool hasAdminRole = collection.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        bool hasMinterRole = collection.hasRole(MINTER_ROLE, deployer);
        bool hasBurnerRole = collection.hasRole(BURNER_ROLE, deployer);
        bool hasMetadataRole = collection.hasRole(METADATA_ROLE, deployer);

        console.log("\nRoles du deployeur:");
        console.log("   Admin:", hasAdminRole ? "OUI" : "NON");
        console.log("   Minter:", hasMinterRole ? "OUI" : "NON");
        console.log("   Burner:", hasBurnerRole ? "OUI" : "NON");
        console.log("   Metadata:", hasMetadataRole ? "OUI" : "NON");

        // Vérification des paramètres initiaux
        console.log("\nParametres initiaux du contrat:");
        console.log("   Supply maximale:", collection.maxSupply());
        console.log("   Prix de mint:", collection.mintPrice());
        console.log("   Max par wallet:", collection.maxMintPerWallet());
        console.log("   Max par transaction:", collection.maxMintPerTransaction());
        console.log("   Total minte:", collection.totalMinted());
        console.log("   Supply restante:", collection.remainingSupply());

        // Sauvegarde des informations de déploiement
        console.log("\nInformations de deploiement:");
        console.log("   Reseau:", block.chainid);
        console.log("   Contrat: ERC721Collection");
        console.log("   Adresse:", address(collection));
        console.log("   Deployeur:", deployer);
        console.log("   Timestamp:", block.timestamp);

        console.log("\nDeploiement termine avec succes!");
        console.log("\nProchaines etapes:");
        console.log("   1. Verifier le contrat sur l'explorer");
        console.log("   2. Configurer l'URI de base pour les metadonnees");
        console.log("   3. Preparer les metadonnees des NFTs");
        console.log("   4. Tester le mint de quelques NFTs");
        console.log("   5. Lancer la vente publique!");

        // Sauvegarde de l'adresse dans un fichier pour utilisation ultérieure
        string memory deploymentInfo = string(abi.encodePacked(
            "ERC721Collection deployed at: ",
            vm.toString(address(collection)),
            "\nNetwork: ",
            vm.toString(block.chainid),
            "\nDeployer: ",
            vm.toString(deployer),
            "\nTimestamp: ",
            vm.toString(block.timestamp)
        ));

        vm.writeFile("deployment-info.txt", deploymentInfo);
        console.log("\nInformations sauvegardees dans deployment-info.txt");
    }
}
