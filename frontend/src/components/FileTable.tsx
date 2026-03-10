import React from "react";
import { Link } from "react-router-dom";

export type FileRow = {
  id: string;
  file_name: string;
  sha256_hash: string;
  status: string;
  created_at: string;
  blockchain_tx_hash?: string | null;
};

export const FileTable: React.FC<{ items: FileRow[] }> = ({ items }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>SHA-256</th>
          <th>Status</th>
          <th>Created</th>
          <th>On-chain</th>
        </tr>
      </thead>
      <tbody>
        {items.map((f) => (
          <tr key={f.id}>
            <td>
              <Link to={`/files/${f.id}`}>{f.file_name}</Link>
            </td>
            <td>
              <code>{f.sha256_hash.slice(0, 12)}…</code>
            </td>
            <td>{f.status}</td>
            <td>{new Date(f.created_at).toLocaleString()}</td>
            <td>{f.blockchain_tx_hash ? <span className="ok">YES</span> : <span className="muted">no</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

