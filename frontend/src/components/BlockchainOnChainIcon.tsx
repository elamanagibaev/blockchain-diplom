import React from "react";
import { Clock, ShieldCheck } from "lucide-react";

type Props = {
  onChain: boolean;
};

/** Иконка наличия записи в блокчейне (таблица «Мои патенты»). */
export const BlockchainOnChainIcon: React.FC<Props> = ({ onChain }) => {
  const label = onChain ? "Зарегистрирован в блокчейне" : "Ещё не в блокчейне";
  return (
    <span
      className="blockchain-onchain-icon-wrap"
      title={label}
      role="img"
      aria-label={label}
    >
      {onChain ? (
        <ShieldCheck size={18} color="#2e7d52" strokeWidth={1.75} aria-hidden />
      ) : (
        <Clock size={18} color="#9ca3af" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
};
