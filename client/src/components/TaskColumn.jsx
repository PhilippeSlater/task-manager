import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";

export default function TaskColumn({ id, title, tasks, onCreateTask, onDeleteTask }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [value, setValue] = useState("");

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onCreateTask(id, t);
    setValue("");
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: 260,
        padding: 14,
        borderRadius: 16,
        border: isOver
          ? "1px solid rgba(79, 140, 255, 0.75)"
          : "1px solid rgba(255,255,255,0.12)",
        background: isOver ? "rgba(79, 140, 255, 0.12)" : "rgba(0,0,0,0.18)",
        transition: "120ms",
        minHeight: 220,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>

      {/* Create task */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Nouvelle tâche..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={submit}>
          +
        </button>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onDelete={() => onDeleteTask(t.id)} />
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
