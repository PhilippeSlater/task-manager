// client/src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { DndContext, closestCorners } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import api from "../services/api";
import TaskColumn from "../components/TaskColumn";
import TaskCreateModal from "../components/TaskCreateModal";
import TaskEditModal from "../components/TaskEditModal";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState(null);

  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [newBoardName, setNewBoardName] = useState("");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [socket, setSocket] = useState(null);

  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingBoardData, setLoadingBoardData] = useState(false);

  const [toast, setToast] = useState(null);

  const [newColumnName, setNewColumnName] = useState("");
  const [creatingColumn, setCreatingColumn] = useState(false);

  const prevBoardRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // --- Load boards on mount
  useEffect(() => {
    setLoadingBoards(true);
    api
      .get("/boards")
      .then((res) => {
        setBoards(res.data);
        const last = sessionStorage.getItem("lastBoardId");
        const lastId = last ? Number(last) : null;

        const exists = lastId && res.data.some(b => Number(b.id) === lastId);
        if (exists) loadBoard(lastId);
        else if (res.data.length) loadBoard(Number(res.data[0].id));
      })
      .catch(() => {
        sessionStorage.removeItem("token");
        window.location.href = "/login";
      })
      .finally(() => setLoadingBoards(false));
  }, []);

  // --- Socket init (once)
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    setSocket(s);

    // TASK events (filter by current board)
    s.on("taskCreated", (t) => {
      const nt = normalizeTask(t);
      if (Number(nt.board_id) !== Number(prevBoardRef.current)) return;
      setTasks((prev) => (prev.some((x) => x.id === nt.id) ? prev : [...prev, nt]));
    });

    s.on("taskUpdated", (t) => {
      const nt = normalizeTask(t);
      if (Number(nt.board_id) !== Number(prevBoardRef.current)) return;
      setTasks((prev) => prev.map((x) => (x.id === nt.id ? { ...x, ...nt } : x)));
    });

    s.on("taskDeleted", ({ id, board_id }) => {
      if (board_id !== prevBoardRef.current) return;
      setTasks((prev) => prev.filter((x) => x.id !== id));
    });

    // COLUMN events (optional; only if your backend emits them)
    s.on("columnCreated", (c) => {
      const nc = normalizeColumn(c);
      if (nc.board_id !== prevBoardRef.current) return;
      setColumns((prev) => (prev.some((x) => x.id === nc.id) ? prev : [...prev, nc]));
    });

    s.on("columnUpdated", (c) => {
      const nc = normalizeColumn(c);
      if (nc.board_id !== prevBoardRef.current) return;
      setColumns((prev) => prev.map((x) => (x.id === nc.id ? { ...x, ...nc } : x)));
    });

    s.on("columnDeleted", ({ id, board_id }) => {
      if (board_id !== prevBoardRef.current) return;
      setColumns((prev) => prev.filter((x) => x.id !== id));
      setTasks((prev) => prev.filter((t) => t.column_id !== id));
    });

    s.on("columnsReordered", ({ board_id, columnIds }) => {
      if (Number(board_id) !== Number(prevBoardRef.current)) return;

      setColumns((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        return columnIds
          .map((id, idx) => {
            const c = map.get(id);
            return c ? { ...c, position: idx } : null;
          })
          .filter(Boolean);
      });
    });

    return () => {
      s.off("taskCreated");
      s.off("taskUpdated");
      s.off("taskDeleted");
      s.off("columnCreated");
      s.off("columnUpdated");
      s.off("columnDeleted");
      s.off("columnsReordered");
      s.disconnect();
    };
  }, []);

  const normalizeTask = (t) => ({
    ...t,
    id: Number(t.id),
    board_id: Number(t.board_id),
    column_id: Number(t.column_id),
    position: Number(t.position ?? 0),
  });

  const normalizeColumn = (c) => ({
    ...c,
    id: Number(c.id),
    board_id: Number(c.board_id),
    position: Number(c.position ?? 0),
  });

  // --- Load board: columns + tasks
  const loadBoard = async (boardId) => {
    const id = Number(boardId); 
    if (!Number.isInteger(id)) return;
    setShowCreateTask(false);
    setEditingTask(null);
    setLoadingBoardData(true);

    // leave old room / join new 
    const prev = prevBoardRef.current;
    if (socket && prev) socket.emit("board:leave", prev);
    if (socket) socket.emit("board:join", id);

    prevBoardRef.current = id;
    setSelectedBoardId(id);

    // clear UI while loading
    setColumns([]);
    setTasks([]);

    try {
      const [colsRes, tasksRes] = await Promise.all([
        api.get(`/boards/${boardId}/columns`),
        api.get(`/tasks/board/${boardId}`),
      ]);

      setColumns(colsRes.data.map(normalizeColumn));
      setTasks(tasksRes.data.map(normalizeTask));
      console.log("cols ids:", colsRes.data.map(c => [c.id, typeof c.id]));
      console.log("tasks col:", tasksRes.data.map(t => [t.column_id, typeof t.column_id]));
    } catch (e) {
      console.error(e);
      showToast("Impossible de charger le board (colonnes/tâches)", "error");
    } finally {
      setLoadingBoardData(false);
      sessionStorage.setItem("lastBoardId", String(boardId));
    }
  };

  // --- Derived: sorted columns
  const columnsSorted = useMemo(() => {
    return [...columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [columns]);

  // --- Derived: tasks grouped by column_id
  const tasksByColumnId = useMemo(() => {
    const map = new Map();
    for (const c of columnsSorted) map.set(c.id, []);
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, []);
      map.get(t.column_id).push(t);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      map.set(k, arr);
    }
    return map;
  }, [tasks, columnsSorted]);

  // --- Create board
  const createBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;

    try {
      const res = await api.post("/boards", { name });
      setBoards((prev) => [res.data, ...prev]);
      setNewBoardName("");
      showToast("Board créé");
    } catch (e) {
      console.error(e);
      showToast("Impossible de créer le board", "error");
    }
  };

  // --- Create task (modal) expects: { title, description, column_id }
  const createTask = async ({ title, description, column_id }) => {
    if (!selectedBoardId) return showToast("Choisis un board d’abord", "error");
    const colId = Number(column_id);
    if (!Number.isInteger(colId)) return showToast("Colonne invalide", "error");

    try {
      const position = tasks.filter((t) => t.column_id === colId).length;

      await api.post("/tasks", {
        board_id: selectedBoardId,
        column_id: colId,
        title,
        description,
        position,
      });

      // Let socket add it (or you can refetch if you want)
      setShowCreateTask(false);
    } catch (e) {
      console.error(e);
      showToast("Impossible de créer la tâche", "error");
    }
  };

  // --- Save task edits (modal)
  const saveTask = async (id, patch) => {
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    try {
      await api.patch(`/tasks/${id}`, patch);
      setEditingTask(null);
    } catch (e) {
      console.error(e);
      setTasks(previous);
      showToast("Impossible de sauvegarder la tâche", "error");
    }
  };

  // --- Delete task
  const deleteTask = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await api.delete(`/tasks/${id}`);
      setEditingTask(null);
    } catch (e) {
      console.error(e);
      setTasks(previous);
      showToast("Impossible de supprimer la tâche", "error");
    }
  };
  

  const onDragEnd = async ({ active, over }) => {
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("col:") && overId.startsWith("col:")) {
      const activeColId = Number(activeId.replace("col:", ""));
      const overColId = Number(overId.replace("col:", ""));

      const oldIndex = columnsSorted.findIndex((c) => c.id === activeColId);
      const newIndex = columnsSorted.findIndex((c) => c.id === overColId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const previous = columns;

      // ordre optimiste (UI)
      const moved = arrayMove(columnsSorted, oldIndex, newIndex).map((c, idx) => ({
        ...c,
        position: idx,
      }));

      setColumns(moved);

      try {
        await api.patch(`/boards/${selectedBoardId}/columns/reorder`, {
          columnIds: moved.map((c) => c.id),
        });
      } catch (e) {
        console.error(e);
        setColumns(previous);
        showToast("Erreur reorder colonnes", "error");
      }

      return;
    }


    if (!activeId.startsWith("task:")) return;

    const taskId = Number(activeId.replace("task:", ""));
    const activeTask = tasks.find((t) => Number(t.id) === taskId);
    if (!activeTask) return;

    // Déterminer la colonne cible
    let targetColumnId = null;

    if (overId.startsWith("col:")) {
      targetColumnId = Number(overId.replace("col:", ""));
    } else if (overId.startsWith("task:")) {
      const overTaskId = Number(overId.replace("task:", ""));
      const overTask = tasks.find((t) => Number(t.id) === overTaskId);
      targetColumnId = overTask?.column_id ?? null;
    }

    if (!Number.isInteger(targetColumnId)) return;

    const sourceColumnId = activeTask.column_id;

    // Liste source & cible (triées)
    const sourceList = tasks
      .filter((t) => t.column_id === sourceColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const targetList = tasks
      .filter((t) => t.column_id === targetColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const sourceIndex = sourceList.findIndex((t) => t.id === taskId);

    // Si drop sur une task, index cible = index de cette task
    let targetIndex = targetList.length; // drop sur colonne => fin
    if (overId.startsWith("task:")) {
      const overTaskId = Number(overId.replace("task:", ""));
      targetIndex = targetList.findIndex((t) => t.id === overTaskId);
      if (targetIndex < 0) targetIndex = targetList.length;
    }

    // --- Construire la nouvelle liste source/cible
    let newSource = [...sourceList];
    let newTarget = sourceColumnId === targetColumnId ? newSource : [...targetList];

    // retirer l’item de la source
    const [moved] = newSource.splice(sourceIndex, 1);

    // si on change de colonne, on modifie column_id
    const movedUpdated = { ...moved, column_id: targetColumnId };

    // insérer dans cible
    newTarget.splice(targetIndex, 0, movedUpdated);

    // si même colonne => c’est juste un reorder (arrayMove simplifie)
    if (sourceColumnId === targetColumnId) {
      newTarget = arrayMove(sourceList, sourceIndex, targetIndex);
    }

    // recalcul positions (0..n-1)
    newSource = newSource.map((t, i) => ({ ...t, position: i }));
    newTarget = newTarget.map((t, i) => ({ ...t, position: i }));

    // optimistic UI (remplacer toutes les tasks des colonnes touchées)
    const previous = tasks;
    setTasks((prev) => {
      const others = prev.filter(
        (t) => t.column_id !== sourceColumnId && t.column_id !== targetColumnId
      );
      const merged =
        sourceColumnId === targetColumnId
          ? [...others, ...newTarget]
          : [...others, ...newSource, ...newTarget];

      return merged;
    });

    // --- Persistance (simple et fiable) : patch les tasks impactées
    // (tu peux optimiser plus tard avec un endpoint bulk)
    try {
      const toSave =
        sourceColumnId === targetColumnId ? newTarget : [...newSource, ...newTarget];

      await Promise.all(
        toSave.map((t) =>
          api.patch(`/tasks/${t.id}`, { column_id: t.column_id, position: t.position })
        )
      );
    } catch (e) {
      console.error(e);
      setTasks(previous);
      showToast("Erreur lors du réordonnancement", "error");
    }
  };

  const logout = () => {
    sessionStorage.removeItem("token"); // (ton code avait sessionStorage)
    window.location.href = "/";
  };

  const deleteBoard = async () => {
    if (!selectedBoardId) return;

    const b = boards.find((x) => x.id === selectedBoardId);
    const ok = window.confirm(
      `Supprimer le board "${b?.name}" ?\nToutes les tâches seront supprimées.`
    );
    if (!ok) return;

    try {
      await api.delete(`/boards/${selectedBoardId}`);

      setBoards((prev) => prev.filter((x) => x.id !== selectedBoardId));
      setSelectedBoardId(null);
      prevBoardRef.current = null;
      setColumns([]);
      setTasks([]);
      setShowCreateTask(false);
      setEditingTask(null);
      showToast("Board supprimé");
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Impossible de supprimer le board", "error");
    }
  };
  const createColumn = async () => {
    if (!selectedBoardId) return showToast("Choisis un board", "error");

    const name = newColumnName.trim();
    if (!name) return;

    try {
      setCreatingColumn(true);

      const position = columnsSorted.length; // à la fin
      const res = await api.post(`/boards/${selectedBoardId}/columns`, { name, position });
      const nc = normalizeColumn(res.data);

      setColumns((prev) => (prev.some((c) => c.id === nc.id) ? prev : [...prev, nc]));
      setNewColumnName("");
      showToast("Colonne créée");
    } catch (e) {
      console.error(e);
      showToast("Impossible de créer la colonne", "error");
    } finally {
      setCreatingColumn(false);
    }
  };

  const renameColumn = async (columnId, name) => {
    if (!selectedBoardId) return;

    // optimistic
    const prev = columns;
    setColumns((p) => p.map((c) => (c.id === columnId ? { ...c, name } : c)));

    try {
      await api.patch(`/boards/${selectedBoardId}/columns/${columnId}`, { name });
      showToast("Colonne renommée");
      // socket columnUpdated va aussi arriver (ok)
    } catch (e) {
      console.error(e);
      setColumns(prev);
      showToast("Impossible de renommer la colonne", "error");
    }
  };

  const removeColumn = async (columnId) => {
    if (!selectedBoardId) return;

    try {
      await api.delete(`/boards/${selectedBoardId}/columns/${columnId}`);
      showToast("Colonne supprimée");
      // socket columnDeleted va enlever côté client (ou tu peux le faire ici aussi)
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "Impossible de supprimer la colonne";
      showToast(msg, "error");
    }
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

      {loadingBoards && <div style={{ opacity: 0.75 }}>Chargement des boards…</div>}

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
            onClick={() => loadBoard(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {selectedBoardId && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={deleteBoard}>
            🗑️ Supprimer board
          </button>
          <input
            className="input"
            style={{ width: 220 }}
            placeholder="Nouvelle colonne…"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createColumn()}
          />

          <button
            className="btn btn-secondary"
            style={{ width: "auto" }}
            onClick={createColumn}
            disabled={creatingColumn || !newColumnName.trim()}
          >
            + Colonne
          </button>
          <button
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={() => setShowCreateTask(true)}
            disabled={!selectedBoardId || columnsSorted.length === 0}
            title={!selectedBoardId ? "Choisis un board d’abord" : ""}
          >
            + Task
          </button>
        </div>
      )}

      {!selectedBoardId ? (
        <div style={{ opacity: 0.75 }}>Choisis un board pour voir les tâches.</div>
      ) : loadingBoardData ? (
        <div style={{ opacity: 0.75 }}>Chargement du board…</div>
      ) : columnsSorted.length === 0 ? (
        <div style={{ opacity: 0.75 }}>
          Aucune colonne sur ce board. (Ajoute des colonnes côté backend/UI)
        </div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <SortableContext
            items={columnsSorted.map((c) => `col:${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              {columnsSorted.map((col) => (
                <TaskColumn
                  key={col.id}
                  column={col}
                  tasks={tasksByColumnId.get(col.id) || []}
                  onOpenTask={(t) => setEditingTask(t)}
                  onRenameColumn={renameColumn}
                  onDeleteColumn={removeColumn}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modals */}
      {showCreateTask && (
        <TaskCreateModal
          columns={columnsSorted}
          onClose={() => setShowCreateTask(false)}
          onCreate={createTask}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          columns={columnsSorted}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background:
              toast.type === "error"
                ? "rgba(255, 70, 70, 0.18)"
                : "rgba(70, 180, 120, 0.18)",
            color: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            maxWidth: 320,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
