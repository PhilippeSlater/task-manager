import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";

export default function TaskColumn({ id, title, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id }); //Droppable column

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
        minHeight: 160, //Add minimum for empty column
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 12 }}>{title}</div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
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
