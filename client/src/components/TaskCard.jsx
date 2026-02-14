import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function TaskCard({ task, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task:${task.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* click */}
      <div
        onClick={onOpen}
        style={{ cursor: "pointer", fontWeight: 800, marginBottom: 8 }}
      >
        {task.title}
      </div>

      {task.description && (
        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
          {task.description}
        </div>
      )}

      {/* drag handle */}
      <div
        {...attributes}
        {...listeners}
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
        ⠿ Déplacer
      </div>
    </div>
  );
}
