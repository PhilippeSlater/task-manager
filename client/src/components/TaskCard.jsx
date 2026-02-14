import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export default function TaskCard({ task, onOpen }) {
  const dragId = `task:${task.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useDraggable({ id: dragId });

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
      {/* Click zone: open edit modal */}
      <div
        onClick={onOpen}
        style={{
          cursor: "pointer",
          fontWeight: 800,
          lineHeight: 1.2,
          marginBottom: 8,
        }}
      >
        {task.title}
      </div>

      {task.description && (
        <div style={{ opacity: 0.75, fontSize: 13, marginBottom: 10 }}>
          {task.description}
        </div>
      )}

      {/* Drag handle ONLY (so clicks are reliable) */}
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.20)",
          cursor: "grab",
          userSelect: "none",
          opacity: 0.85,
          fontSize: 13,
        }}
        title="Glisser pour déplacer"
      >
        ⠿ Déplacer
      </div>
    </div>
  );
}
