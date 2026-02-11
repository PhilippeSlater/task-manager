import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function TaskCard({ task, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    marginBottom: 10,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Delete button */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}   // ✅ important
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.25)",
          color: "rgba(255,255,255,0.8)",
          borderRadius: 10,
          padding: "4px 8px",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* Drag handle (seul endroit draggable) */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          fontWeight: 700,
          paddingRight: 30,
          userSelect: "none",
        }}
      >
        ⠿ {task.title}
      </div>

      {task.description && (
        <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
          {task.description}
        </div>
      )}
    </div>
  );
}
