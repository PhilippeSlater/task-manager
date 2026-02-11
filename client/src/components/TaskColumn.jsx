import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";

export default function TaskColumn({ id, title, tasks }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 260,
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 12 }}>{title}</div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </SortableContext>
    </div>
  );
}
