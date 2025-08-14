// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract MarketplaceV3 is AccessControl, ReentrancyGuard, Pausable {
    using Address for address payable;

    bytes32 public constant EXTENSION_ROLE = keccak256("EXTENSION_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant ROYALTY_MANAGER_ROLE = keccak256("ROYALTY_MANAGER_ROLE");

    struct Extension {
        address extension;
        bool enabled;
        string name;
    }

    struct PlatformFee {
        uint16 bps;
        address recipient;
    }

    mapping(bytes32 => Extension) public extensions;
    mapping(bytes32 => bool) public extensionIds;
    bytes32[] public allExtensionIds;

    PlatformFee public platformFee;
    address public royaltyEngine;
    address public nativeTokenWrapper;

    event ExtensionAdded(bytes32 indexed extensionId, address indexed extension, string name);
    event ExtensionRemoved(bytes32 indexed extensionId, address indexed extension);
    event ExtensionUpdated(bytes32 indexed extensionId, address indexed extension, string name);
    event PlatformFeeUpdated(uint16 bps, address recipient);
    event RoyaltyEngineUpdated(address indexed royaltyEngine);

    constructor(
        address _admin,
        uint16 _platformFeeBps,
        address _platformFeeRecipient,
        address _royaltyEngine,
        address _nativeTokenWrapper
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EXTENSION_ROLE, _admin);
        _grantRole(FEE_MANAGER_ROLE, _admin);
        _grantRole(ROYALTY_MANAGER_ROLE, _admin);
        
        _setRoleAdmin(EXTENSION_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(FEE_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ROYALTY_MANAGER_ROLE, DEFAULT_ADMIN_ROLE);

        platformFee = PlatformFee({
            bps: _platformFeeBps,
            recipient: _platformFeeRecipient
        });

        royaltyEngine = _royaltyEngine;
        nativeTokenWrapper = _nativeTokenWrapper;
    }

    function addExtension(
        bytes32 _extensionId,
        address _extension,
        string calldata _name
    ) external onlyRole(EXTENSION_ROLE) {
        require(_extension != address(0), "Extension cannot be zero address");
        require(!extensionIds[_extensionId], "Extension ID already exists");

        extensions[_extensionId] = Extension({
            extension: _extension,
            enabled: true,
            name: _name
        });

        extensionIds[_extensionId] = true;
        allExtensionIds.push(_extensionId);

        emit ExtensionAdded(_extensionId, _extension, _name);
    }

    function removeExtension(bytes32 _extensionId) external onlyRole(EXTENSION_ROLE) {
        require(extensionIds[_extensionId], "Extension ID does not exist");

        delete extensions[_extensionId];
        delete extensionIds[_extensionId];

        // Remove from array
        for (uint256 i = 0; i < allExtensionIds.length; i++) {
            if (allExtensionIds[i] == _extensionId) {
                allExtensionIds[i] = allExtensionIds[allExtensionIds.length - 1];
                allExtensionIds.pop();
                break;
            }
        }

        emit ExtensionRemoved(_extensionId, extensions[_extensionId].extension);
    }

    function updateExtension(
        bytes32 _extensionId,
        address _extension,
        string calldata _name
    ) external onlyRole(EXTENSION_ROLE) {
        require(extensionIds[_extensionId], "Extension ID does not exist");
        require(_extension != address(0), "Extension cannot be zero address");

        extensions[_extensionId].extension = _extension;
        extensions[_extensionId].name = _name;

        emit ExtensionUpdated(_extensionId, _extension, _name);
    }

    function setPlatformFee(uint16 _bps, address _recipient) external onlyRole(FEE_MANAGER_ROLE) {
        require(_bps <= 1000, "Platform fee cannot exceed 10%");
        require(_recipient != address(0), "Recipient cannot be zero address");

        platformFee.bps = _bps;
        platformFee.recipient = _recipient;

        emit PlatformFeeUpdated(_bps, _recipient);
    }

    function setRoyaltyEngine(address _royaltyEngine) external onlyRole(ROYALTY_MANAGER_ROLE) {
        royaltyEngine = _royaltyEngine;
        emit RoyaltyEngineUpdated(_royaltyEngine);
    }

    function setNativeTokenWrapper(address _nativeTokenWrapper) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nativeTokenWrapper = _nativeTokenWrapper;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getExtension(bytes32 _extensionId) external view returns (Extension memory) {
        return extensions[_extensionId];
    }

    function getAllExtensionIds() external view returns (bytes32[] memory) {
        return allExtensionIds;
    }

    function getPlatformFee() external view returns (PlatformFee memory) {
        return platformFee;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Function to receive native tokens (HYPE)
    receive() external payable {
        // Allow receiving native tokens
    }

    // Function to withdraw native tokens (emergency)
    function withdrawNativeTokens() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No native tokens to withdraw");
        
        payable(msg.sender).sendValue(balance);
    }

    // Function to withdraw ERC20 tokens (emergency)
    function withdrawERC20Tokens(address _token, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_token != address(0), "Token cannot be zero address");
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20(_token).transfer(msg.sender, _amount);
    }
}
