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
  //State to create new board and new task
  const [newBoardName, setNewBoardName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState({ todo: "", doing: "", done: "" });

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
      if (board_id !== selectedBoardId) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
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

  const createBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;

    const res = await api.post("/boards", { name });
    setBoards((prev) => [res.data, ...prev]);
    setNewBoardName("");
  };


  //Don't use optimistic in create. It will duplicate
  const createTask = async (status, title) => {
    if (!selectedBoardId) return;

    try {
      await api.post("/tasks", {
        board_id: selectedBoardId,
        title,
        status,
        position: tasks.filter((t) => t.status === status).length,
      });
    } catch (e) {
      console.error(e);
      alert("Impossible de créer la tâche");
    }
  };


  const deleteTask = async (taskId) => {
    if (typeof taskId === "string" && taskId.startsWith("temp-")) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return;
    }

    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.delete(`/tasks/${taskId}`);
    } catch (e) {
      console.error("DELETE FAILED", e?.response?.data || e.message);
      setTasks(previous);
      alert(e?.response?.data?.message || "Impossible de supprimer la tâche");
    }
  };


  //Set the DnD
  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id; //The current task moving
    const overId = over.id; //Where we drop it (column("todo", "doing", ...) or another task(id))

    //Find the task we are movinh
    const activeTask = tasks.find((t) => t.id === taskId);
    if (!activeTask) return;

    //did we drop on another task (is the over.id another task or a column)
    const overTask = tasks.find((t) => t.id === overId);

    //On another task, get status
    //Else get the over.id, its the column name
    const targetStatus = overTask ? overTask.status : overId;
    if (!["todo", "doing", "done"].includes(targetStatus)) return;

    //Find all task in the same status
    const targetList = tasks.filter((t) => t.status === targetStatus && t.id !== taskId);
    //Add as the last column element
    const newPosition = targetList.length;

    // optimistic UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: targetStatus, position: newPosition } : t
      )
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: targetStatus, position: newPosition });
    } catch (e) {
      console.error(e);
      //Reload all task from the DB, and display the truth
      if (selectedBoardId) loadTasks(selectedBoardId);
    }
  };


  return (
    <div style={{ padding: 20 }}>
      <button
        className="btn btn-secondary"
        style={{ width: "auto" }}
        onClick={() => {
          localStorage.removeItem("token");
          window.location.href = "/";
        }}
      >
        Logout
      </button>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Nouveau board..."
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
        />
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={createBoard}>
          + Créer board
        </button>
      </div>
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
            <TaskColumn id="todo" title="À faire" tasks={byStatus.todo} onCreateTask={createTask} onDeleteTask={deleteTask} />
            <TaskColumn id="doing" title="En cours" tasks={byStatus.doing} onCreateTask={createTask} onDeleteTask={deleteTask} />
            <TaskColumn id="done" title="Terminé" tasks={byStatus.done} onCreateTask={createTask} onDeleteTask={deleteTask} />
          </div>
        </DndContext>
      )}
    </div>
  );
}
