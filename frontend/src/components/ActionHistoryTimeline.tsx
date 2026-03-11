import React from "react";

export type ActionItem = {
  id?: string;
  action_type: string;
  performed_at: string;
  details?: string | null;
  blockchain_tx_hash?: string | null;
};

export const ActionHistoryTimeline: React.FC<{ items: ActionItem[] }> = ({ items }) => {
  if (!items.length) return <div className="muted">No actions yet.</div>;
  return (
    <div className="grid">
      {items.map((a, idx) => (
        <div className="card" key={a.id || idx}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{a.action_type}</strong>
            <span className="muted">{new Date(a.performed_at).toLocaleString()}</span>
          </div>
          {a.details && <div className="muted" style={{ marginTop: 8 }}>{a.details}</div>}
          {a.blockchain_tx_hash && (
            <div style={{ marginTop: 8 }}>
              <span className="muted">tx:</span> <code>{a.blockchain_tx_hash}</code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

