// client/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { DndContext, closestCorners } from "@dnd-kit/core";

import api from "../services/api";
import TaskColumn from "../components/TaskColumn";
import TaskCreateModal from "../components/TaskCreateModal";
import TaskEditModal from "../components/TaskEditModal";

import { useRef } from "react";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [newBoardName, setNewBoardName] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [socket, setSocket] = useState(null);
  const prevBoardRef = useRef(null);
  // --- Load boards on mount
  useEffect(() => {
    api
      .get("/boards")
      .then((res) => setBoards(res.data))
      .catch(() => {
        // token invalide / expiré
        localStorage.removeItem("token");
        window.location.href = "/login";
      });
  }, []);

  // --- Load tasks for a board
  const loadTasks = async (boardId) => {
    setShowCreateTask(false);
    setEditingTask(null);

    // leave old room
    const prev = prevBoardRef.current;
    if (socket && prev) socket.emit("board:leave", prev);

    // join new room
    if (socket) socket.emit("board:join", boardId);
    prevBoardRef.current = boardId;

    setSelectedBoardId(boardId);
    try {
      const res = await api.get(`/tasks/board/${boardId}`);
      setTasks(res.data);
    } catch (e) {
      console.error(e);
      alert("Impossible de charger les tâches");
    }
  };

  // --- Socket listeners (realtime)
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    setSocket(s);

    // listeners
    s.on("taskCreated", (t) => {
      setTasks((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t]));
    });

    s.on("taskUpdated", (t) => {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
    });

    s.on("taskDeleted", ({ id }) => {
      setTasks((prev) => prev.filter((x) => x.id !== id));
    });

    return () => s.disconnect();
  }, []);


  // --- Derived columns (sorted by position)
  const byStatus = useMemo(() => {
    const sort = (arr) =>
      [...arr].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return {
      todo: sort(tasks.filter((t) => t.status === "todo")),
      doing: sort(tasks.filter((t) => t.status === "doing")),
      done: sort(tasks.filter((t) => t.status === "done")),
    };
  }, [tasks]);

  // --- Create board (UI)
  const createBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;

    try {
      const res = await api.post("/boards", { name });
      setBoards((prev) => [res.data, ...prev]);
      setNewBoardName("");
    } catch (e) {
      console.error(e);
      alert("Impossible de créer le board");
    }
  };

  // --- Create task (modal)
  const createTask = async ({ title, description, status }) => {
    if (!selectedBoardId) {
      alert("Choisis un board d’abord");
      return;
    }

    try {
      const position = tasks.filter((t) => t.status === status).length;
      await api.post("/tasks", {
        board_id: selectedBoardId,
        title,
        description,
        status,
        position,
      });

      // On laisse le socket "taskCreated" ajouter la tâche.
      setShowCreateTask(false);
    } catch (e) {
      console.error(e);
      alert("Impossible de créer la tâche");
    }
  };

  // --- Save task edits (modal)
  const saveTask = async (id, patch) => {
    // optimistic UI
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    try {
      await api.patch(`/tasks/${id}`, patch);
      // socket "taskUpdated" va aussi arriver, mais c’est ok
      setEditingTask(null);
    } catch (e) {
      console.error(e);
      setTasks(previous);
      alert("Impossible de sauvegarder la tâche");
    }
  };

  // --- Delete task (modal)
  const deleteTask = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await api.delete(`/tasks/${id}`);
      // socket "taskDeleted" va aussi arriver
      setEditingTask(null);
    } catch (e) {
      console.error(e);
      setTasks(previous);
      alert("Impossible de supprimer la tâche");
    }
  };

  // --- Drag & drop
  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const overId = over.id;

    const activeTask = tasks.find((t) => t.id === taskId);
    if (!activeTask) return;

    //If drop on a task get the task
    const overTask = tasks.find((t) => t.id === overId);

    // if drop on column, overId = "todo"/"doing"/"done"
    const targetStatus = overTask ? overTask.status : overId;

    if (!["todo", "doing", "done"].includes(targetStatus)) return;

    // Add at the end
    const newPosition = tasks.filter(
      (t) => t.status === targetStatus && t.id !== taskId
    ).length;

    if (activeTask.status === targetStatus) {
      const endPos = tasks.filter((t) => t.status === targetStatus && t.id !== taskId).length;
      if (activeTask.position === endPos) return;
    }

    // optimistic UI
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: targetStatus, position: newPosition } : t
      )
    );

    try {
      await api.patch(`/tasks/${taskId}`, {
        status: targetStatus,
        position: newPosition,
      });
    } catch (e) {
      console.error(e);
      setTasks(previous);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ opacity: 0.7, marginTop: 4, fontSize: 13 }}>
            Sélectionne un board, puis ajoute/modifie tes tâches.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={logout}>
                Logout
          </button>
        </div>
      </div>

      {/* Create board */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Nouveau board..."
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createBoard()}
        />
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={createBoard}>
          + Créer board
        </button>
      </div>

      {/* Boards list */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {boards.map((b) => (
          <button
            key={b.id}
            className="btn btn-secondary"
            style={{
              width: "auto",
              borderColor:
                selectedBoardId === b.id ? "rgba(79, 140, 255, 0.6)" : undefined,
            }}
            onClick={() => loadTasks(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {!selectedBoardId ? (
        <div style={{ opacity: 0.75 }}>Choisis un board pour voir les tâches.</div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ width: "auto" }}
              onClick={() => setShowCreateTask(true)}
              disabled={!selectedBoardId}
              title={!selectedBoardId ? "Choisis un board d’abord" : ""}
            >
              + Task
            </button>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TaskColumn
              id="todo"
              title="À faire"
              tasks={byStatus.todo}
              onOpenTask={(t) => setEditingTask(t)}
            />
            <TaskColumn
              id="doing"
              title="En cours"
              tasks={byStatus.doing}
              onOpenTask={(t) => setEditingTask(t)}
            />
            <TaskColumn
              id="done"
              title="Terminé"
              tasks={byStatus.done}
              onOpenTask={(t) => setEditingTask(t)}
            />
          </div>
        </DndContext>
      )}

      {/* Modals */}
      {showCreateTask && (
        <TaskCreateModal
          onClose={() => setShowCreateTask(false)}
          onCreate={createTask}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}
    </div>
  );
}
