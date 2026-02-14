import { useDroppable } from "@dnd-kit/core";
import TaskCard from "./TaskCard";

export default function TaskColumn({ id, title, tasks, onOpenTask }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: 280,
        maxWidth: 420,
        padding: 14,
        borderRadius: 16,
        border: isOver
          ? "1px solid rgba(79, 140, 255, 0.75)"
          : "1px solid rgba(255,255,255,0.12)",
        background: isOver ? "rgba(79, 140, 255, 0.12)" : "rgba(0,0,0,0.18)",
        transition: "120ms",
        minHeight: 240,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 12 }}>{title}</div>

      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />
      ))}

      {tasks.length === 0 && (
        <div style={{ opacity: 0.55, fontSize: 13, padding: "8px 2px" }}>
          Dépose une tâche ici
        </div>
      )}
    </div>
  );
}
