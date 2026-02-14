import { useEffect, useState } from "react";
import Modal from "./Modal";
import api from "../services/api";

export default function BoardAdminModal({ boardId, onClose }) {
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/boards/${boardId}/members`);
      setMembers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [boardId]);

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setBusy(true);
    try {
      await api.post(`/boards/${boardId}/members`, { email: e });
      setEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId) => {
    const ok = window.confirm("Retirer cet accès ?");
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/boards/${boardId}/members/${userId}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Admin du board" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Email à inviter"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
        />
        <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !email.trim()} onClick={invite}>
          + Inviter
        </button>
      </div>

      {loading ? (
        <div style={{ opacity: 0.75 }}>Chargement…</div>
      ) : members.length === 0 ? (
        <div style={{ opacity: 0.75 }}>Aucun membre.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{m.email}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{m.role}</div>
              </div>

              {m.role === "owner" ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>Owner</div>
              ) : (
                <button className="btn btn-secondary" style={{ width: "auto" }} disabled={busy} onClick={() => remove(m.id)}>
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
