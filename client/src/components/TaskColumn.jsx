// client/src/components/TaskColumn.jsx
import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import TaskCard from "./TaskCard";

export default function TaskColumn({
  column,
  tasks,
  isOwner,
  onOpenTask,
  onRenameColumn,
  onDeleteColumn,
}) {
  const colId = `col:${column.id}`;

  // droppable (pour drop task)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: colId });

  // sortable (pour déplacer colonne) — DISABLED si pas owner
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: colId, disabled: !isOwner });

  const setNodeRef = (node) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    flex: "0 0 320px",
    minWidth: 280,
    maxWidth: 420,
    padding: 14,
    borderRadius: 16,
    border: isOver
      ? "1px solid rgba(79, 140, 255, 0.75)"
      : "1px solid rgba(255,255,255,0.12)",
    background: isOver ? "rgba(79, 140, 255, 0.12)" : "rgba(0,0,0,0.18)",
    minHeight: 240,
    position: "relative",
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(column?.name || "");
  const inputRef = useRef(null);

  useEffect(() => {
    setName(column?.name || "");
  }, [column?.name]);

  useEffect(() => {
    if (editingName) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editingName]);

  const commitRename = () => {
    const n = name.trim();
    setEditingName(false);
    setMenuOpen(false);

    if (!n || n === column.name) {
      setName(column.name);
      return;
    }
    onRenameColumn?.(column.id, n);
  };

  const askDelete = () => {
    setMenuOpen(false);
    const ok = window.confirm(`Supprimer la colonne "${column.name}" ?`);
    if (!ok) return;
    onDeleteColumn?.(column.id);
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {/* ✅ handle colonne owner only */}
        {isOwner && (
          <div
            {...attributes}
            {...listeners}
            title="Déplacer la colonne"
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.20)",
              cursor: "grab",
              userSelect: "none",
              opacity: 0.85,
              fontSize: 13,
            }}
          >
            ⠿
          </div>
        )}

        <div style={{ flex: 1, fontWeight: 900 }}>
          {!editingName ? (
            column.name
          ) : (
            <input
              ref={inputRef}
              className="input"
              style={{ height: 34 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setName(column.name);
                }
              }}
            />
          )}
        </div>

        {/* ✅ menu owner only */}
        {isOwner && (
          <button
            className="btn btn-secondary"
            style={{ width: "auto", padding: "6px 10px" }}
            onClick={() => setMenuOpen((v) => !v)}
            title="Options"
            type="button"
          >
            ⋯
          </button>
        )}
      </div>

      {/* Menu */}
      {isOwner && menuOpen && (
        <div
          style={{
            position: "absolute",
            top: 52,
            right: 14,
            width: 200,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(20,20,25,0.95)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            padding: 8,
            zIndex: 10,
          }}
        >
          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start" }}
            type="button"
            onClick={() => setEditingName(true)}
          >
            ✏️ Renommer
          </button>

          <div style={{ height: 8 }} />

          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start" }}
            type="button"
            onClick={askDelete}
          >
            🗑️ Supprimer
          </button>

          <div style={{ height: 8 }} />

          <button
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "flex-start", opacity: 0.8 }}
            type="button"
            onClick={() => setMenuOpen(false)}
          >
            Fermer
          </button>
        </div>
      )}

      {/* Tasks */}
      <SortableContext
        items={tasks.map((t) => `task:${t.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <div style={{ opacity: 0.55, fontSize: 13, padding: "8px 2px" }}>
          Dépose une tâche ici
        </div>
      )}
    </div>
  );
}
