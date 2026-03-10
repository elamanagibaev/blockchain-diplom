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
    Thin wrapper around web3.py + contract ABI.
    For diploma MVP we keep it simple and make it optional:
    if env vars are not set, blockchain endpoints should return 503.
    """

    def __init__(self) -> None:
        if not settings.WEB3_PROVIDER_URL:
            raise BlockchainNotConfiguredError("Blockchain provider is not configured")

        contract_address = settings.CONTRACT_ADDRESS
        if not contract_address:
            # Allow dockerized auto-deploy to pass address via shared volume.
            try:
                contract_address = Path(settings.CONTRACT_ADDRESS_FILE).read_text(encoding="utf-8").strip()
            except Exception:
                contract_address = None
        if not contract_address:
            raise BlockchainNotConfiguredError(
                "Contract address not configured. Deploy contract or set CONTRACT_ADDRESS."
            )

        self.w3 = Web3(Web3.HTTPProvider(str(settings.WEB3_PROVIDER_URL)))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        abi: list[dict[str, Any]] = []
        # Prefer shared ABI file from dockerized deploy
        shared_abi_path = Path(settings.CONTRACT_ABI_FILE)
        if shared_abi_path.exists():
            abi = json.loads(shared_abi_path.read_text(encoding="utf-8"))
        else:
            abi_path = Path(__file__).parent / "abi" / "FileRegistry.json"
            with abi_path.open("r", encoding="utf-8") as f:
                abi = json.load(f)
        if not abi:
            raise BlockchainNotConfiguredError("Contract ABI is empty. Deploy contract and export ABI.")

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=abi,
        )

    def _send_tx(self, fn) -> str:
        if not settings.CONTRACT_OWNER_PRIVATE_KEY or not settings.CONTRACT_OWNER_ADDRESS:
            raise BlockchainNotConfiguredError("Contract owner key/address not configured")

        from_addr = Web3.to_checksum_address(settings.CONTRACT_OWNER_ADDRESS)
        nonce = self.w3.eth.get_transaction_count(from_addr)
        tx = fn.build_transaction(
            {
                "from": from_addr,
                "nonce": nonce,
                "chainId": settings.CHAIN_ID,
                "gasPrice": self.w3.eth.gas_price,
            }
        )
        signed = self.w3.eth.account.sign_transaction(tx, private_key=settings.CONTRACT_OWNER_PRIVATE_KEY)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt.transactionHash.hex()

    def register_object(self, object_id: str, file_hash: str, owner: str, metadata_uri: str, status: str) -> str:
        owner_addr = Web3.to_checksum_address(owner)
        fn = self.contract.functions.registerObject(object_id, file_hash, owner_addr, metadata_uri, status)
        return self._send_tx(fn)

    def append_action(self, object_id: str, action_type: str, actor: str, details: str) -> str:
        actor_addr = Web3.to_checksum_address(actor)
        fn = self.contract.functions.appendAction(object_id, action_type, actor_addr, details)
        return self._send_tx(fn)

    def transfer_ownership(self, object_id: str, new_owner: str) -> str:
        new_owner_addr = Web3.to_checksum_address(new_owner)
        fn = self.contract.functions.transferOwnership(object_id, new_owner_addr)
        return self._send_tx(fn)

    def get_object(self, object_id: str) -> Optional[dict[str, Any]]:
        result = self.contract.functions.getObject(object_id).call()
        exists = result[6]
        if not exists:
            return None
        return {
            "object_id": object_id,
            "file_hash": result[0],
            "owner": result[1],
            "registered_at": result[2],
            "metadata_uri": result[3],
            "current_status": result[4],
            "exists": exists,
        }

    def get_actions(self, object_id: str) -> list[dict[str, Any]]:
        actions = self.contract.functions.getActions(object_id).call()
        out: list[dict[str, Any]] = []
        for a in actions:
            out.append({"action_type": a[0], "timestamp": a[1], "actor": a[2], "details": a[3]})
        return out

