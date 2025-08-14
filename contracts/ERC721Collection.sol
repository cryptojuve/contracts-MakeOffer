// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ERC721Collection is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Burnable, 
    AccessControl, 
    ReentrancyGuard, 
    Pausable 
{
    // Rôles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");

    // Variables d'état
    uint256 private _tokenIdCounter;
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public maxMintPerWallet;
    uint256 public maxMintPerTransaction;
    
    // Base URI pour les métadonnées
    string private _baseTokenURI;
    
    // Mapping pour suivre les mints par wallet
    mapping(address => uint256) public walletMintCount;
    
    // Événements
    event TokenMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event TokenBurned(address indexed from, uint256 indexed tokenId);
    event MetadataUpdated(uint256 indexed tokenId, string newTokenURI);
    event MintPriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event BaseURIUpdated(string newBaseURI);

    /**
     * @dev Constructeur du contrat
     * @param name Nom de la collection
     * @param symbol Symbole de la collection
     * @param _maxSupply Nombre maximum de tokens
     * @param _mintPrice Prix de mint en wei
     * @param _maxMintPerWallet Nombre maximum de mints par wallet
     * @param _maxMintPerTransaction Nombre maximum de mints par transaction
     * @param _admin Adresse de l'administrateur
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _maxMintPerWallet,
        uint256 _maxMintPerTransaction,
        address _admin
    ) ERC721(name, symbol) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        maxMintPerWallet = _maxMintPerWallet;
        maxMintPerTransaction = _maxMintPerTransaction;
        
        // Attribution des rôles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(BURNER_ROLE, _admin);
        _grantRole(METADATA_ROLE, _admin);
        
        // Configuration des rôles
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(METADATA_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
     * @dev Mint d'un token unique
     * @param to Adresse du destinataire
     * @param tokenUri URI des métadonnées du token
     */
    function mint(address to, string memory tokenUri) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
        require(_tokenIdCounter < maxSupply, "Max supply reached");
        require(to != address(0), "Cannot mint to zero address");
        
        uint256 tokenId = _tokenIdCounter;
        ++_tokenIdCounter;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
        
        emit TokenMinted(to, tokenId, tokenUri);
        return tokenId;
    }

    /**
     * @dev Mint de plusieurs tokens
     * @param to Adresse du destinataire
     * @param quantity Quantité de tokens à mint
     * @param baseTokenURI URI de base pour les métadonnées
     */
    function mintBatch(
        address to, 
        uint256 quantity, 
        string memory baseTokenURI
    ) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        returns (uint256[] memory) 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(quantity > 0, "Quantity must be greater than 0");
        require(_tokenIdCounter + quantity <= maxSupply, "Exceeds max supply");
        require(quantity <= maxMintPerTransaction, "Exceeds max mint per transaction");
        
        uint256[] memory tokenIds = new uint256[](quantity);
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _tokenIdCounter;
            ++_tokenIdCounter;
            
            string memory tokenUri = string(abi.encodePacked(baseTokenURI, "/", _toString(tokenId)));
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenUri);
            
            tokenIds[i] = tokenId;
            emit TokenMinted(to, tokenId, tokenUri);
        }
        
        return tokenIds;
    }

    /**
     * @dev Mint public avec paiement
     * @param quantity Quantité de tokens à mint
     */
    function publicMint(uint256 quantity) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        returns (uint256[] memory) 
    {
        require(quantity > 0, "Quantity must be greater than 0");
        require(quantity <= maxMintPerTransaction, "Exceeds max mint per transaction");
        require(msg.value == mintPrice * quantity, "Incorrect payment amount");
        require(_tokenIdCounter + quantity <= maxSupply, "Exceeds max supply");
        require(walletMintCount[msg.sender] + quantity <= maxMintPerWallet, "Exceeds max mint per wallet");
        
        uint256[] memory tokenIds = new uint256[](quantity);
        
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _tokenIdCounter;
            ++_tokenIdCounter;
            
            string memory tokenUri = string(abi.encodePacked(_baseTokenURI, "/", _toString(tokenId)));
            
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, tokenUri);
            
            tokenIds[i] = tokenId;
            emit TokenMinted(msg.sender, tokenId, tokenUri);
        }
        
        walletMintCount[msg.sender] += quantity;
        
        return tokenIds;
    }

    /**
     * @dev Mise à jour des métadonnées d'un token
     * @param tokenId ID du token
     * @param newTokenURI Nouvelle URI des métadonnées
     */
    function updateTokenURI(uint256 tokenId, string memory newTokenURI) 
        external 
        onlyRole(METADATA_ROLE) 
    {
        require(tokenId < _tokenIdCounter, "Token does not exist");
        _setTokenURI(tokenId, newTokenURI);
        emit MetadataUpdated(tokenId, newTokenURI);
    }

    /**
     * @dev Mise à jour du prix de mint
     * @param newPrice Nouveau prix en wei
     */
    function updateMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }

    /**
     * @dev Mise à jour de la supply maximale
     * @param newMaxSupply Nouvelle supply maximale
     */
    function updateMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply >= _tokenIdCounter, "New max supply too low");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /**
     * @dev Mise à jour de l'URI de base
     * @param newBaseURI Nouvelle URI de base
     */
    function updateBaseURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @dev Mise à jour des limites de mint
     * @param newMaxMintPerWallet Nouvelle limite par wallet
     * @param newMaxMintPerTransaction Nouvelle limite par transaction
     */
    function updateMintLimits(
        uint256 newMaxMintPerWallet, 
        uint256 newMaxMintPerTransaction
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxMintPerWallet = newMaxMintPerWallet;
        maxMintPerTransaction = newMaxMintPerTransaction;
    }

    /**
     * @dev Pause du contrat
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause du contrat
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Retrait des fonds du contrat
     */
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Retrait d'urgence des tokens ERC20
     * @param token Adresse du token ERC20
     * @param amount Montant à retirer
     */
    function emergencyWithdrawERC20(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(0), "Invalid token address");
        
        // Interface ERC20 basique
        (bool success, ) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", msg.sender, amount)
        );
        require(success, "ERC20 transfer failed");
    }

    // Fonctions de vue
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function remainingSupply() external view returns (uint256) {
        return maxSupply - _tokenIdCounter;
    }

    function getWalletMintCount(address wallet) external view returns (uint256) {
        return walletMintCount[wallet];
    }

    // Overrides nécessaires
    // Note: _burn function removed as it's not virtual in OpenZeppelin v5

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Fonction utilitaire pour convertir uint256 en string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // Fonction pour recevoir des paiements
    receive() external payable {
        // Permet de recevoir des paiements en ETH
    }
}
