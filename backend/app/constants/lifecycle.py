"""Жизненный цикл цифрового документа (строковые значения в digital_objects.status)."""

from enum import Enum


class LifecycleStatus(str, Enum):
    """Статус обработки документа."""

    UPLOADED = "UPLOADED"  # файл принят (кратковременно, до FREEZE)
    FROZEN = "FROZEN"  # хэш зафиксирован, логическая заморозка
    UNDER_REVIEW = "UNDER_REVIEW"  # на согласовании / проверке
    # Устаревшее имя; в дипломном потоке заменено на DEAN_APPROVED (оставлено для старых записей)
    APPROVED = "APPROVED"
    # Деканат подтвердил — далее только автоматика (этапы 4–5), без возврата на кафедру
    DEAN_APPROVED = "DEAN_APPROVED"
    # Запись в смарт-контракте выполнена (этап 4)
    REGISTERED = "REGISTERED"
    REGISTERED_ON_CHAIN = "REGISTERED_ON_CHAIN"  # синоним в старых данных / совместимость
    ASSIGNED_TO_OWNER = "ASSIGNED_TO_OWNER"  # этап 5 — закрепление за student_wallet
    REJECTED = "REJECTED"
    TRANSFERRED = "TRANSFERRED"


# Обратная совместимость при чтении старых записей (до миграции)
LEGACY_STATUS_MAP = {
    "PENDING_APPROVAL": LifecycleStatus.UNDER_REVIEW.value,
}


def status_allows_on_chain_registration(status: str) -> bool:
    """После DEAN_APPROVED (или устаревшего APPROVED) допускается запись в реестр."""
    return status in (LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value)


def is_ledger_registered_status(status: str) -> bool:
    """Документ прошёл on-chain (этап 4) или дальше."""
    return status in (
        LifecycleStatus.REGISTERED.value,
        LifecycleStatus.REGISTERED_ON_CHAIN.value,
        LifecycleStatus.ASSIGNED_TO_OWNER.value,
    )
