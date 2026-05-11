# Приложение А

## Блокчейн-реестр цифровых документов

### FileRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FileRegistry - blockchain control records for digital objects
/// @notice Stores ONLY hashes and control metadata. Never stores file content.
contract FileRegistry {
    struct DigitalObject {
        string fileHash;
        address owner;
        uint256 registeredAt;
        string metadataURI;
        string currentStatus;
        bool exists;
    }

    struct Action {
        string actionType;
        uint256 timestamp;
        address actor;
        string details;
    }

    mapping(string => DigitalObject) private objects;
    mapping(string => Action[]) private actionsByObject;
    mapping(string => bool) private hashes;

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
```

Продолжение приложения А

```solidity
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
```

Продолжение приложения А

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
}
```

# Приложение Б

## Python backend платформы хранения и верификации

### blockchain/client.py

```python
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from web3 import Web3
from web3.middleware import geth_poa_middleware

from app.core.config import get_settings

settings = get_settings()


class BlockchainNotConfiguredError(RuntimeError):
    pass


class BlockchainClient:
    """
    Wrapper around web3.py and smart contract ABI.
    """

    def __init__(self) -> None:
        if not settings.WEB3_PROVIDER_URL:
            raise BlockchainNotConfiguredError("Blockchain provider is not configured")

        contract_address = settings.CONTRACT_ADDRESS
        if not contract_address:
            contract_address = Path(settings.CONTRACT_ADDRESS_FILE).read_text(
                encoding="utf-8"
            ).strip()

        self.w3 = Web3(Web3.HTTPProvider(str(settings.WEB3_PROVIDER_URL)))

        try:
            from web3.middleware import ExtraDataToPOAMiddleware
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except ImportError:
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        abi_path = Path(__file__).parent / "abi" / "FileRegistry.json"
        with abi_path.open("r", encoding="utf-8") as f:
            abi: list[dict[str, Any]] = json.load(f)

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=abi,
        )
```

Продолжение приложения Б

```python
    def _send_tx(self, fn) -> str:
        if not settings.CONTRACT_OWNER_PRIVATE_KEY or not settings.CONTRACT_OWNER_ADDRESS:
            raise BlockchainNotConfiguredError("Contract owner key/address not configured")

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
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()

    def register_object(self, object_id: str, file_hash: str, owner: str, metadata_uri: str, status: str) -> str:
        owner_addr = Web3.to_checksum_address(owner)
        fn = self.contract.functions.registerObject(object_id, file_hash, owner_addr, metadata_uri, status)
        return self._send_tx(fn)

    def hash_exists(self, file_hash: str) -> bool:
        return self.contract.functions.hashExists(file_hash).call()

    def get_object(self, object_id: str) -> Optional[dict[str, Any]]:
        result = self.contract.functions.getObject(object_id).call()
        if not result[6]:
            return None
        return {
            "object_id": object_id,
            "file_hash": result[0],
            "owner": result[1],
            "registered_at": result[2],
            "metadata_uri": result[3],
            "current_status": result[4],
        }
```

### services/file_service.py

```python
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_MIME_PREFIXES = ("application/pdf", "image/", "text/")
ALLOWED_MIME_EXACT = frozenset({
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})


def _safe_filename(name: str) -> str:
    name = (name or "").strip() or "file"
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(r'[\x00-\x1f<>:"|?*]', "_", name)
    if name in (".", ".."):
        name = "file"
    return name[:255] or "file"


def normalize_student_wallet(addr: str) -> str:
    raw = (addr or "").strip()
    if len(raw) != 42 or not raw.startswith("0x"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Введите корректный EVM-адрес кошелька",
        )
    return Web3.to_checksum_address(raw)
```

Продолжение приложения Б

```python
class FileService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.storage = get_storage_backend()

    def register_file(
        self,
        user: User,
        file: UploadFile,
        description: str,
        student_wallet: str,
    ) -> DigitalObject:
        if user.role != "department":
            raise HTTPException(status_code=403, detail="Only department can upload documents")

        raw = file.file.read()
        if len(raw) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File too large")

        filename = _safe_filename(file.filename or "file")
        mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
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
            mime_type=mime,
            size_bytes=len(raw),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description=description,
            student_wallet_address=normalize_student_wallet(student_wallet),
            status=LifecycleStatus.FROZEN.value,
        )
        self.db.add(obj)
        self.db.flush()
        return obj
```

### services/blockchain_service.py

```python
def _normalize_owner_wallet(addr: str) -> str:
    raw = (addr or "").strip()
    if len(raw) != 42 or not raw.startswith("0x"):
        raise HTTPException(status_code=400, detail="Incorrect owner wallet")
    return Web3.to_checksum_address(raw)


class BlockchainService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def register_on_chain(
        self,
        obj: DigitalObject,
        owner: User,
        *,
        initiated_by: User | None = None,
        on_chain_owner_wallet: str | None = None,
        commit: bool = True,
    ) -> str:
        if not status_allows_on_chain_registration(obj.status):
            raise HTTPException(status_code=400, detail="Document must be approved")

        if obj.blockchain_tx_hash:
            raise HTTPException(status_code=400, detail="Document already registered")

        owner_wallet = _normalize_owner_wallet(on_chain_owner_wallet or owner.wallet_address)
        client = BlockchainClient()

        if client.hash_exists(obj.sha256_hash):
            raise HTTPException(status_code=400, detail="Hash already registered on-chain")

        object_id = str(obj.id)
        metadata_uri = f"offchain://digital_objects/{obj.id}"
        tx_hash = client.register_object(
            object_id,
            obj.sha256_hash,
            owner_wallet,
            metadata_uri,
            "REGISTERED_ON_CHAIN",
        )
```

Продолжение приложения Б

```python
        obj.status = LifecycleStatus.REGISTERED.value
        obj.blockchain_registered_at = datetime.now(timezone.utc)
        obj.owner_wallet_address = owner_wallet
        obj.blockchain_object_id = object_id
        obj.blockchain_tx_hash = tx_hash

        self.db.add(BlockchainEvent(
            action_type="REGISTER",
            document_id=obj.id,
            tx_hash=tx_hash,
            to_wallet=owner_wallet,
            initiator_user_id=(initiated_by or owner).id,
        ))

        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=(initiated_by or owner).id,
            action=DocumentEventAction.REGISTER.value,
            metadata={
                "tx_hash": tx_hash,
                "blockchain_object_id": object_id,
                "metadata_uri": metadata_uri,
                "owner_wallet": owner_wallet,
            },
        )

        if commit:
            self.db.commit()
            self.db.refresh(obj)
        else:
            self.db.flush()

        return tx_hash
```

### services/verification_service.py

```python
VerifyStatus = Literal["VALID", "INVALID", "NOT_FOUND"]


def _on_chain_authentic(obj: DigitalObject) -> bool:
    return is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)


class VerificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def verify_file_upload(
        self,
        upload: UploadFile,
        user: Optional[User],
    ) -> tuple[str, Optional[DigitalObject], VerifyStatus]:
        raw = upload.file.read()
        sha = sha256_file(BytesIO(raw))
        uid = user.id if user else None

        obj = (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner))
            .filter(DigitalObject.sha256_hash == sha)
            .first()
        )

        self.db.add(VerificationLog(
            digital_object_id=obj.id if obj else None,
            requested_by_id=uid,
            sha256_hash=sha,
            is_verified=bool(obj and _on_chain_authentic(obj)),
        ))

        if not obj:
            self.db.commit()
            return sha, None, "NOT_FOUND"
        if not _on_chain_authentic(obj):
            self.db.commit()
            return sha, obj, "INVALID"

        self.db.commit()
        return sha, obj, "VALID"
```

### services/approval_workflow_service.py

```python
ACTION_APPROVE = "APPROVE"
ACTION_REJECT = "REJECT"

STAGE_DEPARTMENT_REVIEW = "DEPARTMENT_REVIEW"
STAGE_DEAN_REVIEW = "DEAN_REVIEW"

DEFAULT_APPROVAL_STAGES = [
    {
        "code": STAGE_DEPARTMENT_REVIEW,
        "title": "Проверка кафедрой",
        "stage_order": 1,
        "allowed_roles": ["department"],
    },
    {
        "code": STAGE_DEAN_REVIEW,
        "title": "Согласование деканатом",
        "stage_order": 2,
        "allowed_roles": ["dean"],
    },
]


class ApprovalWorkflowService:
    def _current_stage(self, document_id: UUID) -> ApprovalStageDefinition | None:
        stages = self._get_stage_definitions()
        latest = self._latest_actions_by_stage(document_id)
        for stage in stages:
            stage_action = latest.get(stage.id)
            if not stage_action or stage_action.action != ACTION_APPROVE:
                return stage
        return None

    def _check_actor_can_act(self, actor: User, stage: ApprovalStageDefinition) -> None:
        allowed_roles = list(stage.allowed_roles or [])
        if actor.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Role cannot approve this stage")
```

### services/diploma_automation_service.py

```python
class DiplomaAutomationService:
    def __init__(self, db: Session) -> None:
        self.db = db

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

        self._assign_owner_from_student_wallet(
            document,
            student_wallet,
            initiated_by,
            tx_hash,
            automatic=True,
        )
        document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return True
```

### core/security.py

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        subject = payload.get("sub")
        if not isinstance(subject, str):
            return None
        return subject
    except JWTError:
        return None
```

# Приложение В

## API публичной проверки документов

### api/routes/verification.py

```python
router = APIRouter(prefix="/verify", tags=["verification"])


@router.post("/file", response_model=FileVerificationResult)
async def verify_file(
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    sha, obj, status = VerificationService(db).verify_file_upload(upload_file, current_user)
    return _result_from(sha, obj, status, db)


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

Продолжение приложения В

```python
@router.get("/{document_id}", response_model=PublicVerifyDocumentResponse)
def verify_document_public(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == document_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")

    base = settings.PUBLIC_VERIFY_BASE_URL.rstrip("/")
    verify_url = f"{base}/verify/doc/{document_id}"
    authentic = is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)

    return PublicVerifyDocumentResponse(
        document_id=obj.id,
        status=obj.status,
        owner_email=obj.owner.email if obj.owner else None,
        owner_wallet_address=obj.owner_wallet_address,
        registration_timestamp=obj.blockchain_registered_at or obj.created_at,
        sha256_hash=obj.sha256_hash,
        verify_url=verify_url,
        is_authentic=authentic,
        tx_hash=obj.blockchain_tx_hash,
        tx_explorer_url=make_tx_explorer_url(obj.blockchain_tx_hash),
        file_name=obj.file_name,
        mime_type=obj.mime_type,
        size_bytes=obj.size_bytes,
    )
```

### api/routes/files.py

```python
@router.post("/{obj_id}/submit-for-review")
def submit_for_review(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).submit_for_registration(current_user, obj_id)
    return {"message": "Заявка на согласование отправлена", "status": obj.status}


@router.post("/{obj_id}/register")
def register_document_on_chain(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == obj_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    if obj.status not in (LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value):
        raise HTTPException(status_code=400, detail="Document must be approved")

    tx_hash = BlockchainService(db).register_on_chain(
        obj,
        obj.owner,
        initiated_by=current_admin,
        commit=False,
    )
    FileService(db).migrate_file_to_minio(obj)
    db.commit()

    return {
        "tx_hash": tx_hash,
        "object_id": obj.blockchain_object_id,
        "status": obj.status,
        "tx_explorer_url": make_tx_explorer_url(tx_hash),
    }
```

# Приложение Г

## Клиентское приложение проверки подлинности

### VerifyPage.tsx

```tsx
type VerificationResult = {
  verification_status: string;
  is_verified: boolean;
  digital_object_id: string | null;
  file_name: string | null;
  transaction_hash: string | null;
  integrity_status: string;
  sha256_hash?: string | null;
  sha256_stored?: string | null;
  status?: string | null;
};


function proofBannerMeta(vs: string): { title: string; sub: string; ok: boolean | null } {
  if (vs === "VALID") {
    return {
      ok: true,
      title: "Документ подлинный",
      sub: "Хеш совпадает с записью в блокчейне.",
    };
  }
  if (vs === "NOT_FOUND") {
    return {
      ok: false,
      title: "Документ не найден",
      sub: "Такого SHA-256 нет среди зарегистрированных объектов.",
    };
  }
  if (vs === "INVALID") {
    return {
      ok: false,
      title: "Документ изменен или не подтвержден в реестре",
      sub: "Хеш известен системе, но нет полной on-chain регистрации.",
    };
  }
  return { ok: null, title: vs, sub: "" };
}
```

Продолжение приложения Г

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
    let res;
    if (tab === "hash") {
      res = await api.get<VerificationResult>(
        `/verify/hash/${encodeURIComponent(hash.trim())}`,
      );
    } else {
      const form = new FormData();
      if (file) form.append("upload_file", file);
      res = await api.post<VerificationResult>("/verify/file", form);
    }
    setResult(res.data);
  } catch (err: unknown) {
    setError("Ошибка проверки");
  } finally {
    setLoading(false);
  }
};
```

### StageTimeline.tsx

```tsx
<StageTimeline
  status={result.status || "UNKNOWN"}
  processingStage={result.processing_stage}
  createdAt={result.registered_at}
  sha256Hash={result.sha256_stored || result.sha256_hash || ""}
  departmentApprovedAt={result.department_approved_at}
  deaneryApprovedAt={result.deanery_approved_at}
  aiCheckStatus="skipped"
  blockchainTxHash={result.transaction_hash}
  studentWalletAddress={result.student_wallet_address}
  compact
/>
```

# Приложение Д

## Контейнеризация и запуск платформы

### Dockerfile.backend

```dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic.ini .

RUN mkdir -p /data/files

COPY wait_for_db.py /app/wait_for_db.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

CMD ["/entrypoint.sh"]
```

### Dockerfile.blockchain

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8545

RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
```

### requirements.txt

```txt
fastapi[all]==0.115.0
uvicorn[standard]==0.30.5
python-dotenv==1.0.1
pydantic==2.8.2
pydantic-settings==2.4.0
SQLAlchemy==2.0.32
alembic==1.13.2
psycopg2-binary==2.9.9
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
bcrypt==4.2.0
python-multipart==0.0.9
web3==6.20.1
minio==7.2.10
httpx==0.27.0
cryptography>=41.0.0
```

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: file_registry
    volumes:
      - db_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:RELEASE.2024-12-18T13-15-44Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports:
      - "9000:9000"
      - "9001:9001"

  blockchain:
    build:
      context: ./blockchain
      dockerfile: ../Dockerfile.blockchain
    volumes:
      - chain_shared:/shared
    ports:
      - "8545:8545"
```

Продолжение приложения Д

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: ../Dockerfile.backend
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_started
    environment:
      - SECRET_KEY=CHANGE_ME_SECRET
      - POSTGRES_SERVER=db
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=app
      - POSTGRES_DB=file_registry
      - FILE_STORAGE_BACKEND=minio
      - MINIO_ENDPOINT=minio:9000
      - WEB3_PROVIDER_URL=http://blockchain:8545
      - CHAIN_ID=31337
      - BLOCK_EXPLORER_URL=http://localhost:4000
    volumes:
      - backend_files:/data/files
      - chain_shared:/shared
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: ../Dockerfile.frontend
    depends_on:
      backend:
        condition: service_healthy
    environment:
      - VITE_API_BASE_URL=http://localhost:8000/api
      - VITE_BLOCK_EXPLORER_URL=http://localhost:4000
    ports:
      - "5173:5173"

volumes:
  db_data:
  backend_files:
  minio_data:
  chain_shared:
```

