import { useState } from "react";
import Modal from "./Modal";

export default function TaskCreateModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onCreate({ title: t, description: description.trim() || null, status });
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
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todo">À faire</option>
          <option value="doing">En cours</option>
          <option value="done">Terminé</option>
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
