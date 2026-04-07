"""Жизненный цикл цифрового документа (строковые значения в digital_objects.status)."""

from enum import Enum


class LifecycleStatus(str, Enum):
    """Статус обработки документа."""

    UPLOADED = "UPLOADED"  # файл принят (кратковременно, до FREEZE)
    FROZEN = "FROZEN"  # хэш зафиксирован, логическая заморозка
    UNDER_REVIEW = "UNDER_REVIEW"  # на согласовании / проверке
    APPROVED = "APPROVED"  # допущен к регистрации в сети (перед tx)
    REGISTERED_ON_CHAIN = "REGISTERED_ON_CHAIN"  # в реестре смарт-контракта
    REJECTED = "REJECTED"
    TRANSFERRED = "TRANSFERRED"


# Обратная совместимость при чтении старых записей (до миграции)
LEGACY_STATUS_MAP = {
    "PENDING_APPROVAL": LifecycleStatus.UNDER_REVIEW.value,
    "REGISTERED": LifecycleStatus.FROZEN.value,  # без on-chain — считаем замороженным
}
