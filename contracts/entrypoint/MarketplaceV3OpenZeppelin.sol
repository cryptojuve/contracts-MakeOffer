// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/openzeppelin-contracts/contracts/access/AccessControl.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/utils/Address.sol";
import "lib/openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";

/**
 * @title MarketplaceV3OpenZeppelin
 * @dev Modular marketplace contract using OpenZeppelin
 * @dev Compatible with HyperEVM (HYPE token) and supports extensions
 */
contract MarketplaceV3OpenZeppelin is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    /*///////////////////////////////////////////////////////////////
                        Constants
    //////////////////////////////////////////////////////////////*/

    /// @dev Role for managing extensions
    bytes32 public constant EXTENSION_ROLE = keccak256("EXTENSION_ROLE");
    /// @dev Role for managing platform fees
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    /// @dev Role for managing royalties
    bytes32 public constant ROYALTY_MANAGER_ROLE = keccak256("ROYALTY_MANAGER_ROLE");

    /// @dev Module type identifier
    bytes32 public constant MODULE_TYPE = keccak256("MarketplaceV3");
    /// @dev Version number
    uint256 public constant VERSION = 3;

    /*///////////////////////////////////////////////////////////////
                            Storage
    //////////////////////////////////////////////////////////////*/

    /// @dev Mapping from extension address => extension info
    mapping(address => Extension) public extensions;

    /// @dev Array of all extension addresses
    address[] public extensionAddresses;

    /// @dev Platform fee in basis points (e.g., 250 = 2.5%)
    uint16 public platformFeeBps;

    /// @dev Platform fee recipient
    address public platformFeeRecipient;

    /// @dev Royalty engine address
    address public royaltyEngine;

    /// @dev Native token wrapper contract
    address public nativeTokenWrapper;

    /// @dev Contract metadata URI
    string public contractURI;

    /// @dev Trusted forwarders for meta-transactions
    mapping(address => bool) public trustedForwarders;

    /*///////////////////////////////////////////////////////////////
                            Structs
    //////////////////////////////////////////////////////////////*/

    struct Extension {
        address extensionAddress;
        string name;
        string version;
        bool active;
        uint256 addedAt;
    }

    struct PlatformFee {
        address recipient;
        uint16 bps;
    }

    /*///////////////////////////////////////////////////////////////
                            Events
    //////////////////////////////////////////////////////////////*/

    event ExtensionAdded(
        address indexed extensionAddress,
        string name,
        string version
    );

    event ExtensionRemoved(
        address indexed extensionAddress
    );

    event ExtensionUpdated(
        address indexed extensionAddress,
        string name,
        string version
    );

    event PlatformFeeUpdated(
        address indexed oldRecipient,
        address indexed newRecipient,
        uint16 oldBps,
        uint16 newBps
    );

    event RoyaltyEngineUpdated(
        address indexed oldEngine,
        address indexed newEngine
    );

    event NativeTokenWrapperUpdated(
        address indexed oldWrapper,
        address indexed newWrapper
    );

    event ContractURIUpdated(
        string oldURI,
        string newURI
    );

    event TrustedForwarderAdded(address indexed forwarder);
    event TrustedForwarderRemoved(address indexed forwarder);

    /*///////////////////////////////////////////////////////////////
                            Modifiers
    //////////////////////////////////////////////////////////////*/

    modifier onlyExtension() {
        require(extensions[_msgSender()].active, "Marketplace: not authorized extension");
        _;
    }



    /*///////////////////////////////////////////////////////////////
                            Constructor
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _admin,
        uint16 _platformFeeBps,
        address _platformFeeRecipient,
        address _royaltyEngine,
        address _nativeTokenWrapper
    ) {
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXTENSION_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);
        _grantRole(ROYALTY_MANAGER_ROLE, _admin);

        // Set role hierarchy
        _setRoleAdmin(EXTENSION_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(FEE_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ROYALTY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);

        // Initialize platform fee
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;

        // Initialize other parameters
        royaltyEngine = _royaltyEngine;
        nativeTokenWrapper = _nativeTokenWrapper;
    }

    /*///////////////////////////////////////////////////////////////
                            Extension Management
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a new extension to the marketplace
    /// @param _extensionAddress The address of the extension contract
    /// @param _name The name of the extension
    /// @param _version The version of the extension
    function addExtension(
        address _extensionAddress,
        string calldata _name,
        string calldata _version
    ) external onlyRole(EXTENSION_ROLE) {
        require(_extensionAddress != address(0), "Marketplace: invalid extension address");
        require(!extensions[_extensionAddress].active, "Marketplace: extension already exists");

        extensions[_extensionAddress] = Extension({
            extensionAddress: _extensionAddress,
            name: _name,
            version: _version,
            active: true,
            addedAt: block.timestamp
        });

        extensionAddresses.push(_extensionAddress);

        emit ExtensionAdded(_extensionAddress, _name, _version);
    }

    /// @notice Remove an extension from the marketplace
    /// @param _extensionAddress The address of the extension to remove
    function removeExtension(address _extensionAddress) external onlyRole(EXTENSION_ROLE) {
        require(extensions[_extensionAddress].active, "Marketplace: extension not found");

        extensions[_extensionAddress].active = false;

        // Remove from extensionAddresses array
        for (uint256 i = 0; i < extensionAddresses.length; i++) {
            if (extensionAddresses[i] == _extensionAddress) {
                extensionAddresses[i] = extensionAddresses[extensionAddresses.length - 1];
                extensionAddresses.pop();
                break;
            }
        }

        emit ExtensionRemoved(_extensionAddress);
    }

    /// @notice Update extension information
    /// @param _extensionAddress The address of the extension to update
    /// @param _name The new name
    /// @param _version The new version
    function updateExtension(
        address _extensionAddress,
        string calldata _name,
        string calldata _version
    ) external onlyRole(EXTENSION_ROLE) {
        require(extensions[_extensionAddress].active, "Marketplace: extension not found");

        Extension storage extension = extensions[_extensionAddress];
        string memory oldName = extension.name;
        string memory oldVersion = extension.version;

        extension.name = _name;
        extension.version = _version;

        emit ExtensionUpdated(_extensionAddress, _name, _version);
    }

    /// @notice Get all active extensions
    function getActiveExtensions() external view returns (Extension[] memory) {
        uint256 activeCount = 0;
        Extension[] memory tempExtensions = new Extension[](extensionAddresses.length);

        for (uint256 i = 0; i < extensionAddresses.length; i++) {
            if (extensions[extensionAddresses[i]].active) {
                tempExtensions[activeCount] = extensions[extensionAddresses[i]];
                activeCount++;
            }
        }

        Extension[] memory result = new Extension[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = tempExtensions[i];
        }

        return result;
    }

    /// @notice Check if an address is an active extension
    function isActiveExtension(address _extension) external view returns (bool) {
        return extensions[_extension].active;
    }

    /*///////////////////////////////////////////////////////////////
                            Platform Fee Management
    //////////////////////////////////////////////////////////////*/

    /// @notice Update platform fee settings
    /// @param _newFeeBps New platform fee in basis points
    /// @param _newRecipient New platform fee recipient
    function updatePlatformFee(uint16 _newFeeBps, address _newRecipient)
        external
        onlyRole(FEE_MANAGER_ROLE)
    {
        require(_newFeeBps <= 1000, "Marketplace: fee cannot exceed 10%");
        require(_newRecipient != address(0), "Marketplace: invalid recipient");

        address oldRecipient = platformFeeRecipient;
        uint16 oldBps = platformFeeBps;

        platformFeeBps = _newFeeBps;
        platformFeeRecipient = _newRecipient;

        emit PlatformFeeUpdated(oldRecipient, _newRecipient, oldBps, _newFeeBps);
    }

    /// @notice Get current platform fee settings
    function getPlatformFee() external view returns (PlatformFee memory) {
        return PlatformFee({
            recipient: platformFeeRecipient,
            bps: platformFeeBps
        });
    }

    /*///////////////////////////////////////////////////////////////
                            Royalty Management
    //////////////////////////////////////////////////////////////*/

    /// @notice Update royalty engine address
    /// @param _newEngine New royalty engine address
    function updateRoyaltyEngine(address _newEngine) external onlyRole(ROYALTY_MANAGER_ROLE) {
        address oldEngine = royaltyEngine;
        royaltyEngine = _newEngine;

        emit RoyaltyEngineUpdated(oldEngine, _newEngine);
    }

    /// @notice Calculate royalties for a sale
    /// @param _tokenContract The NFT contract address
    /// @param _tokenId The token ID
    /// @param _salePrice The sale price
    function calculateRoyalties(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _salePrice
    ) external view returns (address recipient, uint256 amount) {
        // This is a placeholder - implement actual royalty calculation logic
        // based on your royalty engine (e.g., Manifold, Rarible, etc.)
        return (address(0), 0);
    }

    /*///////////////////////////////////////////////////////////////
                            Configuration Management
    //////////////////////////////////////////////////////////////*/

    /// @notice Update native token wrapper address
    /// @param _newWrapper New wrapper address
    function updateNativeTokenWrapper(address _newWrapper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldWrapper = nativeTokenWrapper;
        nativeTokenWrapper = _newWrapper;

        emit NativeTokenWrapperUpdated(oldWrapper, _newWrapper);
    }

    /// @notice Update contract URI
    /// @param _newURI New contract URI
    function updateContractURI(string calldata _newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldURI = contractURI;
        contractURI = _newURI;

        emit ContractURIUpdated(oldURI, _newURI);
    }

    /// @notice Add a trusted forwarder for meta-transactions
    /// @param _forwarder The forwarder address to add
    function addTrustedForwarder(address _forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_forwarder != address(0), "Marketplace: invalid forwarder");
        require(!trustedForwarders[_forwarder], "Marketplace: forwarder already trusted");

        trustedForwarders[_forwarder] = true;
        emit TrustedForwarderAdded(_forwarder);
    }

    /// @notice Remove a trusted forwarder
    /// @param _forwarder The forwarder address to remove
    function removeTrustedForwarder(address _forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(trustedForwarders[_forwarder], "Marketplace: forwarder not trusted");

        trustedForwarders[_forwarder] = false;
        emit TrustedForwarderRemoved(_forwarder);
    }

    /// @notice Check if an address is a trusted forwarder
    /// @param _forwarder The address to check
    function isTrustedForwarder(address _forwarder) external view returns (bool) {
        return trustedForwarders[_forwarder];
    }

    /*///////////////////////////////////////////////////////////////
                            Admin Functions
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause the marketplace
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause the marketplace
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Emergency function to recover stuck tokens
    /// @param _token The token address to recover
    /// @param _to The recipient address
    /// @param _amount The amount to recover
    function emergencyRecover(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_to != address(0), "Marketplace: invalid recipient");

        if (_token == address(0)) {
            // Recover native tokens
            payable(_to).sendValue(_amount);
        } else {
            // Recover ERC20 tokens
            IERC20(_token).transfer(_to, _amount);
        }
    }

    /*///////////////////////////////////////////////////////////////
                            Extension Interface
    //////////////////////////////////////////////////////////////*/

    /// @notice Function that extensions can call to verify they are authorized
    function verifyExtension() external view returns (bool) {
        return extensions[_msgSender()].active;
    }

    /// @notice Get marketplace information
    function getMarketplaceInfo() external view returns (
        uint256 version,
        bytes32 moduleType,
        uint16 feeBps,
        address feeRecipient,
        address royaltyEngine,
        address nativeWrapper,
        string memory uri,
        bool isPaused
    ) {
        return (
            VERSION,
            MODULE_TYPE,
            platformFeeBps,
            platformFeeRecipient,
            royaltyEngine,
            nativeTokenWrapper,
            contractURI,
            paused()
        );
    }

    /*///////////////////////////////////////////////////////////////
                            Utility Functions
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the number of extensions
    function getExtensionCount() external view returns (uint256) {
        return extensionAddresses.length;
    }

    /// @notice Get extension address by index
    /// @param _index The index of the extension
    function getExtensionByIndex(uint256 _index) external view returns (address) {
        require(_index < extensionAddresses.length, "Marketplace: index out of bounds");
        return extensionAddresses[_index];
    }

    /// @notice Check if the contract supports an interface
    /// @param interfaceId The interface ID to check
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////
                            Receive Function
    //////////////////////////////////////////////////////////////*/

    receive() external payable {
        // Accept HYPE and WHYPE via fallback
    }
}
