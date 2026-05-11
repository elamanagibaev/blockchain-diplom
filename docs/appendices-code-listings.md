# Приложения. Листинги ключевых фрагментов кода

В данных приложениях представлены основные программные компоненты платформы
для защищенного хранения и верификации данных на основе блокчейна. Листинги
сгруппированы по архитектурным слоям: смарт-контракт и блокчейн-интеграция,
серверная бизнес-логика, сервисы хранения и верификации, а также клиентский
интерфейс проверки подлинности документов.

## Приложение А. Смарт-контракт и блокчейн-реестр цифровых объектов

В приложении А приведены фрагменты, реализующие неизменяемый on-chain реестр.
В блокчейне сохраняются только контрольные данные: идентификатор объекта,
SHA-256 хеш файла, адрес владельца, статус и журнал действий. Содержимое
документов остается во внешнем защищенном хранилище.

### А.1. Структура данных цифрового объекта в смарт-контракте

Фрагмент определяет минимальный набор on-chain данных, достаточный для проверки
целостности и принадлежности документа без раскрытия самого файла.

```solidity
struct DigitalObject {
    string fileHash;      // SHA-256 хеш файла, вычисленный вне блокчейна
    address owner;        // текущий владелец цифрового объекта
    uint256 registeredAt; // время регистрации в блокчейне
    string metadataURI;   // ссылка на off-chain метаданные
    string currentStatus; // текущий статус жизненного цикла
    bool exists;
}

mapping(string => DigitalObject) private objects;
mapping(string => bool) private hashes;
```

### А.2. Регистрация цифрового объекта в блокчейне

Метод `registerObject` исключает повторную регистрацию одного объекта и одного
хеша. Это обеспечивает уникальность записи и предотвращает подмену документа
после вычисления SHA-256.

```solidity
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
    emit ObjectRegistered(objectId, fileHash, owner, block.timestamp, metadataURI, status);
}
```

### А.3. Журналирование действий над объектом

Контракт хранит историю ключевых операций над объектом. Такой подход позволяет
проследить не только факт регистрации, но и последующие изменения статуса или
владельца.

```solidity
struct Action {
    string actionType;
    uint256 timestamp;
    address actor;
    string details;
}

mapping(string => Action[]) private actionsByObject;

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
```

### А.4. Передача права владения цифровым объектом

Метод фиксирует смену владельца в блокчейне и добавляет событие в историю
объекта. Это делает передачу прав проверяемой и воспроизводимой.

```solidity
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
```

## Приложение Б. Серверные компоненты защищенной платформы

В приложении Б представлены серверные модули, отвечающие за загрузку файлов,
вычисление хеша, контроль доступа, согласование документа, регистрацию в
блокчейне и ведение событийного журнала. Серверная часть реализована на Python
с использованием FastAPI, SQLAlchemy и web3.py.

### Б.1. Вычисление хеша, проверка файла и первичная фиксация документа

Сервис загрузки ограничивает типы и размер файлов, нормализует имя, вычисляет
SHA-256 и запрещает повторную регистрацию одинакового содержимого.

```python
def register_file(self, user: User, file: UploadFile, description: str, student_wallet: str) -> DigitalObject:
    if user.role != "department":
        raise HTTPException(status_code=403, detail="Only department can upload documents")

    raw = file.file.read()
    if len(raw) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large")

    filename = _safe_filename(file.filename or "file")
    mime = _normalize_mime_for_upload(file.content_type or "application/octet-stream", filename)
    self._validate_mime(mime)

    sha = sha256_file(BytesIO(raw))
    existing = self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
    if existing:
        raise HTTPException(status_code=400, detail="Document with this hash already exists")

    storage_key = LocalStorageBackend().save(BytesIO(raw), filename)
    obj = DigitalObject(
        owner_id=user.id,
        uploaded_by_id=user.id,
        file_name=filename,
        storage_key=storage_key,
        storage_backend="local",
        sha256_hash=sha,
        status=LifecycleStatus.FROZEN.value,
        student_wallet_address=normalize_student_wallet(student_wallet),
    )
    self.db.add(obj)
    self.db.flush()
    return obj
```

### Б.2. Подключение к смарт-контракту через web3.py

Класс `BlockchainClient` инкапсулирует загрузку ABI, подключение к EVM-сети и
вызовы методов смарт-контракта. Если параметры сети не заданы, блокчейн-функции
возвращают управляемую ошибку конфигурации.

```python
class BlockchainClient:
    def __init__(self) -> None:
        if not settings.WEB3_PROVIDER_URL:
            raise BlockchainNotConfiguredError("Blockchain provider is not configured")

        contract_address = settings.CONTRACT_ADDRESS
        if not contract_address:
            contract_address = Path(settings.CONTRACT_ADDRESS_FILE).read_text(
                encoding="utf-8"
            ).strip()

        self.w3 = Web3(Web3.HTTPProvider(str(settings.WEB3_PROVIDER_URL)))
        abi_path = Path(__file__).parent / "abi" / "FileRegistry.json"
        abi = json.loads(abi_path.read_text(encoding="utf-8"))

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=abi,
        )
```

### Б.3. Подписание и отправка блокчейн-транзакции

Метод `_send_tx` формирует транзакцию, рассчитывает лимит газа, подписывает ее
закрытым ключом сервисного аккаунта и ожидает подтверждение в сети.

```python
def _send_tx(self, fn) -> str:
    from_addr = Web3.to_checksum_address(settings.CONTRACT_OWNER_ADDRESS)
    nonce = self.w3.eth.get_transaction_count(from_addr)

    gas_est = fn.estimate_gas({"from": from_addr})
    tx = fn.build_transaction({
        "from": from_addr,
        "nonce": nonce,
        "chainId": settings.CHAIN_ID,
        "gasPrice": self.w3.eth.gas_price,
        "gas": min(int(gas_est * 1.25) + 50_000, 3_000_000),
    })

    signed = self.w3.eth.account.sign_transaction(
        tx,
        private_key=settings.CONTRACT_OWNER_PRIVATE_KEY,
    )
    raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
    tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
    receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt.transactionHash.hex()
```

### Б.4. Финальная регистрация документа в блокчейне

Сервис допускает on-chain регистрацию только после согласования документа
деканатом. Перед записью проверяется отсутствие ранее зарегистрированного хеша.

```python
def register_on_chain(
    self,
    obj: DigitalObject,
    owner: User,
    initiated_by: User | None = None,
    on_chain_owner_wallet: str | None = None,
) -> str:
    if not status_allows_on_chain_registration(obj.status):
        raise HTTPException(status_code=400, detail="Document is not approved")

    if obj.blockchain_tx_hash:
        raise HTTPException(status_code=400, detail="Document is already registered")

    owner_wallet = _normalize_owner_wallet(on_chain_owner_wallet or owner.wallet_address)
    client = self._client()

    if client.hash_exists(obj.sha256_hash):
        raise HTTPException(status_code=400, detail="Hash already exists on-chain")

    object_id = str(obj.id)
    metadata_uri = f"offchain://digital_objects/{obj.id}"
    tx_hash = client.register_object(
        object_id,
        obj.sha256_hash,
        owner_wallet,
        metadata_uri,
        "REGISTERED_ON_CHAIN",
    )

    obj.status = LifecycleStatus.REGISTERED.value
    obj.blockchain_object_id = object_id
    obj.blockchain_tx_hash = tx_hash
    obj.owner_wallet_address = owner_wallet
    return tx_hash
```

### Б.5. Двухэтапное согласование документа

Модуль согласования определяет последовательность этапов и роли, которым
разрешено принимать решение. После прохождения всех этапов документ переводится
в состояние готовности к блокчейн-регистрации.

```python
DEFAULT_APPROVAL_STAGES = [
    {
        "code": "DEPARTMENT_REVIEW",
        "title": "Проверка кафедрой",
        "stage_order": 1,
        "allowed_roles": ["department"],
    },
    {
        "code": "DEAN_REVIEW",
        "title": "Согласование деканатом",
        "stage_order": 2,
        "allowed_roles": ["dean"],
    },
]

def _current_stage(self, document_id: UUID) -> ApprovalStageDefinition | None:
    stages = self._get_stage_definitions()
    latest = self._latest_actions_by_stage(document_id)
    for stage in stages:
        action = latest.get(stage.id)
        if not action or action.action != ACTION_APPROVE:
            return stage
    return None
```

### Б.6. Автоматизация после согласования деканатом

После финального одобрения сервис автоматически регистрирует документ в
блокчейне и закрепляет его за кошельком выпускника.

```python
def finalize_after_dean_if_ready(self, document: DigitalObject, initiated_by: User) -> bool:
    if document.blockchain_tx_hash:
        return False
    if not status_allows_on_chain_registration(document.status):
        return False

    student_wallet = (document.student_wallet_address or "").strip()
    if not student_wallet:
        return False

    tx_hash = BlockchainService(self.db).register_on_chain(
        document,
        document.owner,
        initiated_by=initiated_by,
        on_chain_owner_wallet=student_wallet,
        commit=False,
        automatic=True,
        workflow="single_stage_dean",
    )

    FileService(self.db).migrate_file_to_minio(document)
    self.db.commit()
    self.db.refresh(document)

    self._assign_owner_from_student_wallet(document, student_wallet, initiated_by, tx_hash, automatic=True)
    document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
    self.db.commit()
    return True
```

### Б.7. Событийный журнал жизненного цикла документа

Сервис `DocumentEventService` добавляет события в текущую транзакцию базы
данных. Журнал используется для аудита загрузки, согласования, проверки и
регистрации в блокчейне.

```python
class DocumentEventService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        *,
        document_id: UUID | None,
        action: str,
        user_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> DocumentEvent:
        event = DocumentEvent(
            document_id=document_id,
            user_id=user_id,
            action=action,
            event_metadata=metadata,
        )
        self.db.add(event)
        return event
```

### Б.8. Защита учетных данных и JWT-аутентификация

Модуль безопасности использует bcrypt для хранения паролей и JWT для передачи
идентификатора пользователя между клиентом и API.

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

## Приложение В. API и интерфейс публичной верификации

В приложении В приведены фрагменты, которые позволяют внешнему пользователю
проверить подлинность документа по файлу, SHA-256 хешу или публичной карточке
документа.

### В.1. Проверка документа по загруженному файлу

API принимает файл, вычисляет его SHA-256, ищет объект в базе и возвращает
вердикт: `VALID`, `INVALID` или `NOT_FOUND`.

```python
@router.post("/file", response_model=FileVerificationResult)
async def verify_file(
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    sha, obj, status = VerificationService(db).verify_file_upload(upload_file, current_user)
    return _result_from(sha, obj, status, db)
```

### В.2. Проверка документа по SHA-256 хешу

Перед поиском хеш очищается и проверяется по длине. Это снижает риск передачи
некорректных данных в слой бизнес-логики.

```python
@router.get("/hash/{sha256}", response_model=FileVerificationResult)
def verify_hash(
    sha256: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    sha256 = sanitize_hash(sha256)
    if len(sha256) != 64:
        return _result_from(sha256, None, "INVALID_HASH", db)

    uid = current_user.id if current_user else None
    obj, status = VerificationService(db).verify_by_hash_public(
        sha256,
        requested_by_id=uid,
        method="hash_lookup",
    )
    return _result_from(sha256, obj, status, db)
```

### В.3. Логика определения подлинности документа

Документ считается подлинным только в том случае, если его хеш найден в системе
и объект имеет подтвержденную on-chain регистрацию.

```python
def _on_chain_authentic(obj: DigitalObject) -> bool:
    return is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)

def verify_by_hash_public(
    self,
    sha: str,
    requested_by_id: Optional[UUID] = None,
    method: str = "hash_lookup",
) -> tuple[Optional[DigitalObject], VerifyStatus]:
    obj = (
        self.db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.sha256_hash == sha)
        .first()
    )

    self.db.add(VerificationLog(
        digital_object_id=obj.id if obj else None,
        requested_by_id=requested_by_id,
        sha256_hash=sha,
        is_verified=bool(obj and _on_chain_authentic(obj)),
    ))

    if not obj:
        return None, "NOT_FOUND"
    if not _on_chain_authentic(obj):
        return obj, "INVALID"
    return obj, "VALID"
```

### В.4. Публичная карточка документа

Эндпоинт формирует публичную информацию о документе: статус, хеш, владельца,
ссылку на проверку и транзакцию в блокчейне.

```python
@router.get("/{document_id}", response_model=PublicVerifyDocumentResponse)
def verify_document_public(document_id: UUID, db: Session = Depends(get_db)):
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == document_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")

    authentic = is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)
    verify_url = f"{settings.PUBLIC_VERIFY_BASE_URL.rstrip('/')}/verify/doc/{document_id}"

    return PublicVerifyDocumentResponse(
        document_id=obj.id,
        status=obj.status,
        owner_wallet_address=obj.owner_wallet_address,
        sha256_hash=obj.sha256_hash,
        verify_url=verify_url,
        is_authentic=authentic,
        tx_hash=obj.blockchain_tx_hash,
        tx_explorer_url=make_tx_explorer_url(obj.blockchain_tx_hash),
    )
```

### В.5. Клиентская отправка файла или хеша на проверку

Фронтенд предоставляет два сценария проверки: загрузку файла и ввод известного
SHA-256. В обоих случаях результат отображается как криптографическое
доказательство подлинности.

```tsx
const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setResult(null);

  if (tab === "file" && !file) {
    setError("Выберите файл");
    return;
  }
  if (tab === "hash" && !hash.trim()) {
    setError("Введите SHA-256");
    return;
  }

  setLoading(true);
  try {
    let response;
    if (tab === "hash") {
      response = await api.get<VerificationResult>(
        `/verify/hash/${encodeURIComponent(hash.trim())}`,
      );
    } else {
      const form = new FormData();
      if (file) form.append("upload_file", file);
      response = await api.post<VerificationResult>("/verify/file", form);
    }

    setResult(response.data);
  } finally {
    setLoading(false);
  }
};
```

### В.6. Отображение результата верификации

Функция преобразует технический статус API в понятное пользователю сообщение.
Это отделяет бизнес-статусы от визуального представления результата.

```tsx
function proofBannerMeta(status: string): { title: string; sub: string; ok: boolean | null } {
  if (status === "VALID") {
    return {
      ok: true,
      title: "Документ подлинный",
      sub: "Хеш совпадает с записью в блокчейне.",
    };
  }
  if (status === "NOT_FOUND") {
    return {
      ok: false,
      title: "Документ не найден",
      sub: "Такого SHA-256 нет среди зарегистрированных объектов.",
    };
  }
  if (status === "INVALID") {
    return {
      ok: false,
      title: "Документ не подтвержден в реестре",
      sub: "Хеш известен системе, но отсутствует полная on-chain регистрация.",
    };
  }
  return { ok: null, title: status, sub: "" };
}
```
