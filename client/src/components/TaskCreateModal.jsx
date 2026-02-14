import { useState } from "react";
import Modal from "./Modal";

export default function TaskCreateModal({ columns, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(columns?.[0]?.id ?? null);

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onCreate({ title: t, description, column_id: Number(columnId) });
  };

  return (
    <Modal title="Créer une tâche" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="label">Titre</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="label">Description</label>
        <textarea
          className="input"
          style={{ minHeight: 90, resize: "vertical" }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="label">Colonne</label>
        <select
          className="input"
          value={columnId}
          onChange={(e) => setColumnId(Number(e.target.value))}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" type="submit">
            Créer
          </button>
        </div>
      </form>
    </Modal>
  );
}
