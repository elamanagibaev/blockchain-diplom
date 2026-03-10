## Дизайн блокчейн-части

### Принцип

Блокчейн используется **только для контрольных записей**:

- SHA-256 хэш файла
- timestamp регистрации
- owner wallet address
- metadataURI (ссылка на off-chain метаданные)
- история действий

**Контент файла** на блокчейн не записывается.

### Контракт `FileRegistry`

Функции:

- `registerObject(objectId, fileHash, owner, metadataURI, status)`
- `appendAction(objectId, actionType, actor, details)`
- `transferOwnership(objectId, newOwner)`
- `getObject(objectId)`
- `hashExists(fileHash)`
- `getActions(objectId)`

События:

- `ObjectRegistered`
- `ActionAppended`
- `OwnershipTransferred`

### Автодеплой в Docker

Контейнер `blockchain` запускает Hardhat node и выполняет `scripts/deploy.js`, который пишет:

- `/shared/contract_address.txt`
- `/shared/FileRegistry.abi.json`

Backend читает эти значения (если `CONTRACT_ADDRESS` не задан).

