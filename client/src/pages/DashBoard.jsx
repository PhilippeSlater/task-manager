import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { io } from "socket.io-client";

import { DndContext, closestCorners } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import TaskColumn from "../components/TaskColumn";

//Change it later 
const SOCKET_URL = "http://localhost:5000";

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [tasks, setTasks] = useState([]);

  //Get all boards for the user
  useEffect(() => {
    api.get("/boards")
      .then((res) => setBoards(res.data))
      .catch(() => (window.location.href = "/login"));
  }, []);

  //Listen socket io emit form api
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on("taskCreated", (t) => {
      if (t.board_id === selectedBoardId) setTasks((prev) => [...prev, t]);
    });

    socket.on("taskUpdated", (t) => {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
    });

    socket.on("taskDeleted", ({ id, board_id }) => {
      if (board_id === selectedBoardId) setTasks((prev) => prev.filter((x) => x.id !== id));
    });

    return () => socket.disconnect();
  }, [selectedBoardId]);

  //Get all tasks from the board
  const loadTasks = async (boardId) => {
    setSelectedBoardId(boardId);
    const res = await api.get(`/tasks/board/${boardId}`);
    setTasks(res.data);
  };

  // Helpers
  const byStatus = useMemo(() => {
    const sort = (arr) => [...arr].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return {
      todo: sort(tasks.filter((t) => t.status === "todo")),
      doing: sort(tasks.filter((t) => t.status === "doing")),
      done: sort(tasks.filter((t) => t.status === "done")),
    };
  }, [tasks]);

  //Set the DnD
  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const overId = over.id;

    //Get column base on the card we landed on
    const overTask = tasks.find((t) => t.id === overId);
    const activeTask = tasks.find((t) => t.id === taskId);
    if (!activeTask) return;

    const targetStatus = overTask ? overTask.status : overId;
    if (!targetStatus) return;

    //Add tasks to the end on the column
    const targetList = tasks.filter((t) => t.status === targetStatus && t.id !== taskId);
    const newPosition = targetList.length;

    // Optimistic UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: targetStatus, position: newPosition } : t
      )
    );

    // Persist backend
    try {
      await api.patch(`/tasks/${taskId}`, { status: targetStatus, position: newPosition });
    } catch (e) {
      console.error(e);
      // fallback: reload board tasks
      if (selectedBoardId) loadTasks(selectedBoardId);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {boards.map((b) => (
          <button
            key={b.id}
            className="btn btn-secondary"
            style={{ width: "auto" }}
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
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <TaskColumn id="todo" title="À faire" tasks={byStatus.todo} />
            <TaskColumn id="doing" title="En cours" tasks={byStatus.doing} />
            <TaskColumn id="done" title="Terminé" tasks={byStatus.done} />
          </div>
        </DndContext>
      )}
    </div>
  );
}
