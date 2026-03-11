// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FileRegistry - blockchain control records for digital objects
/// @notice Stores ONLY hashes and control metadata. Never stores file content.
contract FileRegistry {
    struct DigitalObject {
        string fileHash;      // SHA-256 hex string (computed off-chain)
        address owner;        // current owner wallet
        uint256 registeredAt; // unix timestamp
        string metadataURI;   // reference to off-chain metadata (DB/API)
        string currentStatus; // REGISTERED / TRANSFERRED / etc.
        bool exists;
    }

    struct Action {
        string actionType; // REGISTER, VERIFY, TRANSFER_OWNERSHIP, CREATE_LICENSE, CHANGE_STATUS...
        uint256 timestamp;
        address actor;
        string details;
    }

    mapping(string => DigitalObject) private objects;        // objectId => DigitalObject
    mapping(string => Action[]) private actionsByObject;     // objectId => Action[]
    mapping(string => bool) private hashes;                  // fileHash => exists

    event ObjectRegistered(
        string indexed objectId,
        string fileHash,
        address indexed owner,
        uint256 registeredAt,
        string metadataURI,
        string status
    );

    event ActionAppended(
        string indexed objectId,
        string actionType,
        address indexed actor,
        string details
    );

    event OwnershipTransferred(
        string indexed objectId,
        address indexed previousOwner,
        address indexed newOwner
    );

    function registerObject(
        string memory objectId,
        string memory fileHash,
        address owner,
        string memory metadataURI,
        string memory status
    ) public {
        require(!objects[objectId].exists, "Object already exists");
        require(!hashes[fileHash], "File hash already registered");
        require(owner != address(0), "Owner must be set");

        objects[objectId] = DigitalObject({
            fileHash: fileHash,
            owner: owner,
            registeredAt: block.timestamp,
            metadataURI: metadataURI,
            currentStatus: status,
            exists: true
        });

        hashes[fileHash] = true;

        actionsByObject[objectId].push(Action({
            actionType: "REGISTER",
            timestamp: block.timestamp,
            actor: msg.sender,
            details: "Initial registration"
        }));

        emit ObjectRegistered(objectId, fileHash, owner, block.timestamp, metadataURI, status);
    }

    function appendAction(
        string memory objectId,
        string memory actionType,
        address actor,
        string memory details
    ) public {
        require(objects[objectId].exists, "Object does not exist");

        actionsByObject[objectId].push(Action({
            actionType: actionType,
            timestamp: block.timestamp,
            actor: actor,
            details: details
        }));

        emit ActionAppended(objectId, actionType, actor, details);
    }

    function transferOwnership(string memory objectId, address newOwner) public {
        require(objects[objectId].exists, "Object does not exist");
        require(newOwner != address(0), "New owner must be set");

        address prev = objects[objectId].owner;
        objects[objectId].owner = newOwner;
        objects[objectId].currentStatus = "TRANSFERRED";

        actionsByObject[objectId].push(Action({
            actionType: "TRANSFER_OWNERSHIP",
            timestamp: block.timestamp,
            actor: msg.sender,
            details: "Ownership transfer"
        }));

        emit OwnershipTransferred(objectId, prev, newOwner);
    }

    function getObject(string memory objectId)
        public
        view
        returns (
            string memory fileHash,
            address owner,
            uint256 registeredAt,
            string memory metadataURI,
            string memory currentStatus,
            uint256 actionsCount,
            bool exists
        )
    {
        DigitalObject memory obj = objects[objectId];
        return (
            obj.fileHash,
            obj.owner,
            obj.registeredAt,
            obj.metadataURI,
            obj.currentStatus,
            actionsByObject[objectId].length,
            obj.exists
        );
    }

    function hashExists(string memory fileHash) public view returns (bool) {
        return hashes[fileHash];
    }

    function getActions(string memory objectId) public view returns (Action[] memory) {
        return actionsByObject[objectId];
    }
}

