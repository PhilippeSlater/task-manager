import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function TaskEditModal({ task, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
  }, [task]);

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onSave(task.id, { title: t, description: description.trim() || null, status });
  };

  return (
    <Modal title="Modifier la tâche" onClose={onClose}>
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

        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "space-between" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "auto" }}
            onClick={() => onDelete(task.id)}
          >
            Supprimer
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fermer
            </button>
            <button className="btn btn-primary" type="submit">
              Sauvegarder
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
