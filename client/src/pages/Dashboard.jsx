// client/src/pages/Dashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { DndContext, closestCorners } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import api from "../services/api";
import TaskColumn from "../components/TaskColumn";
import TaskCreateModal from "../components/TaskCreateModal";
import TaskEditModal from "../components/TaskEditModal";
import BoardAdminModal from "../components/BoardAdminModal";

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

  const [showAdmin, setShowAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // --- Invites + Leave board
  const [invites, setInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const prevBoardRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

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

  const normalizeInvite = (i) => ({
    ...i,
    id: Number(i.id),
    board_id: Number(i.board_id),
    invited_by: Number(i.invited_by),
  });

  // --- Load my invites
  const loadInvites = async () => {
    try {
      setLoadingInvites(true);
      const res = await api.get("/me/invitations");
      setInvites((res.data || []).map(normalizeInvite));
    } catch (e) {
      // pas bloquant
      console.error(e);
    } finally {
      setLoadingInvites(false);
    }
  };

  // --- Socket init (once)
  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    setSocket(s);

    const handleConnect = () => {
      const bid = prevBoardRef.current;
      if (bid) s.emit("board:join", bid);
    };
    s.on("connect", handleConnect);
    const userId = s.user?.id; 
    if (userId) s.join(`user:${userId}`);
    // Tasks
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
      if (Number(board_id) !== Number(prevBoardRef.current)) return;
      setTasks((prev) => prev.filter((x) => x.id !== Number(id)));
    });

    // Columns
    s.on("columnCreated", (c) => {
      const nc = normalizeColumn(c);
      if (Number(nc.board_id) !== Number(prevBoardRef.current)) return;
      setColumns((prev) => (prev.some((x) => x.id === nc.id) ? prev : [...prev, nc]));
    });

    s.on("columnUpdated", (c) => {
      const nc = normalizeColumn(c);
      if (Number(nc.board_id) !== Number(prevBoardRef.current)) return;
      setColumns((prev) => prev.map((x) => (x.id === nc.id ? { ...x, ...nc } : x)));
    });

    s.on("columnDeleted", ({ id, board_id }) => {
      if (Number(board_id) !== Number(prevBoardRef.current)) return;
      const colId = Number(id);
      setColumns((prev) => prev.filter((x) => x.id !== colId));
      setTasks((prev) => prev.filter((t) => t.column_id !== colId));
    });

    s.on("columnsReordered", ({ board_id, columnIds }) => {
      if (Number(board_id) !== Number(prevBoardRef.current)) return;

      setColumns((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        return columnIds
          .map((id, idx) => {
            const c = map.get(Number(id));
            return c ? { ...c, position: idx } : null;
          })
          .filter(Boolean);
      });
    });

    // Invites (notifications)
    s.on("inviteCreated", (invite) => {
      const ni = normalizeInvite(invite);
      setInvites((prev) => (prev.some((x) => x.id === ni.id) ? prev : [ni, ...prev]));
      showToast("Nouvelle invitation reçue", "success");
    });

    s.on("inviteResponded", ({ inviteId }) => {
      setInvites((prev) => prev.filter((x) => x.id !== Number(inviteId)));
    });

    return () => {
      s.off("connect", handleConnect);

      s.off("taskCreated");
      s.off("taskUpdated");
      s.off("taskDeleted");

      s.off("columnCreated");
      s.off("columnUpdated");
      s.off("columnDeleted");
      s.off("columnsReordered");

      s.off("inviteCreated");
      s.off("inviteResponded");

      s.disconnect();
    };
  }, []);

  // --- Load boards + invites on mount
  useEffect(() => {
    setLoadingBoards(true);

    Promise.all([
      api.get("/boards"),
      loadInvites(), 
    ])
      .then(([boardsRes]) => {
        const data = boardsRes.data || [];
        setBoards(data);

        const last = sessionStorage.getItem("lastBoardId");
        const lastId = last ? Number(last) : null;

        const exists = lastId && data.some((b) => Number(b.id) === lastId);
        if (exists) loadBoard(lastId);
        else if (data.length) loadBoard(Number(data[0].id));
      })
      .catch(() => {
        sessionStorage.removeItem("token");
        window.location.href = "/login";
      })
      .finally(() => setLoadingBoards(false));
  }, []);

  // --- Load board: columns + tasks + role
  const loadBoard = async (boardId) => {
    const id = Number(boardId);
    if (!Number.isInteger(id)) return;

    setShowCreateTask(false);
    setEditingTask(null);
    setShowAdmin(false);
    setLoadingBoardData(true);

    const prev = prevBoardRef.current;
    if (socket && prev) socket.emit("board:leave", prev);
    if (socket) socket.emit("board:join", id);

    prevBoardRef.current = id;
    setSelectedBoardId(id);

    setColumns([]);
    setTasks([]);

    try {
      const [colsRes, tasksRes, meRes] = await Promise.all([
        api.get(`/boards/${id}/columns`),
        api.get(`/tasks/board/${id}`),
        api.get(`/boards/${id}/me`),
      ]);

      setIsOwner(meRes.data.role === "owner");
      setColumns((colsRes.data || []).map(normalizeColumn));
      setTasks((tasksRes.data || []).map(normalizeTask));
    } catch (e) {
      console.error(e);
      showToast("Impossible de charger le board (colonnes/tâches)", "error");
    } finally {
      setLoadingBoardData(false);
      sessionStorage.setItem("lastBoardId", String(id));
    }
  };

  const columnsSorted = useMemo(() => {
    return [...columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [columns]);

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

  // --- Create task
  const createTask = async ({ title, description, column_id }) => {
    if (!selectedBoardId) return showToast("Choisis un board d’abord", "error");

    const colId = Number(column_id);
    if (!Number.isInteger(colId)) return showToast("Colonne invalide", "error");

    try {
      const position = tasks.filter((t) => t.column_id === colId).length;

      const res = await api.post("/tasks", {
        board_id: selectedBoardId,
        column_id: colId,
        title,
        description,
        position,
      });

      const nt = normalizeTask(res.data);
      setTasks((prev) => (prev.some((x) => x.id === nt.id) ? prev : [...prev, nt]));

      setShowCreateTask(false);
    } catch (e) {
      console.error(e);
      showToast("Impossible de créer la tâche", "error");
    }
  };

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

  // --- Columns CRUD (owner only in UI)
  const createColumn = async () => {
    if (!selectedBoardId) return showToast("Choisis un board", "error");
    if (!isOwner) return showToast("Seul le owner peut créer une colonne", "error");

    const name = newColumnName.trim();
    if (!name) return;

    try {
      setCreatingColumn(true);
      const position = columnsSorted.length;
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
    if (!isOwner) return showToast("Seul le owner peut renommer", "error");

    const prev = columns;
    setColumns((p) => p.map((c) => (c.id === columnId ? { ...c, name } : c)));

    try {
      await api.patch(`/boards/${selectedBoardId}/columns/${columnId}`, { name });
      showToast("Colonne renommée");
    } catch (e) {
      console.error(e);
      setColumns(prev);
      showToast("Impossible de renommer la colonne", "error");
    }
  };

  const removeColumn = async (columnId) => {
    if (!selectedBoardId) return;
    if (!isOwner) return showToast("Seul le owner peut supprimer", "error");

    try {
      await api.delete(`/boards/${selectedBoardId}/columns/${columnId}`);
      showToast("Colonne supprimée");
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Impossible de supprimer la colonne", "error");
    }
  };

  // --- Invitations: accept / decline
  const respondInvite = async (inviteId, action) => {
    try {
      await api.post(`/invitations/${inviteId}/respond`, { action });
      setInvites((prev) => prev.filter((x) => x.id !== Number(inviteId)));

      if (action === "accept") {
        showToast("Invitation acceptée ✅");
        const b = await api.get("/boards");
        setBoards(b.data || []);
      } else {
        showToast("Invitation refusée");
      }
    } catch (e) {
      console.error(e);
      showToast("Impossible de répondre à l'invitation", "error");
    }
  };

  // --- Leave board (member)
  const leaveBoard = async () => {
    if (!selectedBoardId) return;
    if (isOwner) return showToast("Le owner ne peut pas quitter", "error");

    const b = boards.find((x) => Number(x.id) === Number(selectedBoardId));
    const ok = window.confirm(`Quitter le board "${b?.name}" ?`);
    if (!ok) return;

    try {
      await api.delete(`/boards/${selectedBoardId}/members/me`);
      showToast("Tu as quitté le board");

      const bres = await api.get("/boards");
      const list = bres.data || [];
      setBoards(list);

      setSelectedBoardId(null);
      prevBoardRef.current = null;
      setColumns([]);
      setTasks([]);
      setShowCreateTask(false);
      setEditingTask(null);
      setShowAdmin(false);

      if (list.length) loadBoard(Number(list[0].id));
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Impossible de quitter le board", "error");
    }
  };

  // --- DND
  const onDragEnd = async ({ active, over }) => {
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Reorder colonnes (owner only)
    if (activeId.startsWith("col:") && overId.startsWith("col:")) {
      if (!isOwner) return;

      const activeColId = Number(activeId.replace("col:", ""));
      const overColId = Number(overId.replace("col:", ""));

      const oldIndex = columnsSorted.findIndex((c) => c.id === activeColId);
      const newIndex = columnsSorted.findIndex((c) => c.id === overColId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const previous = columns;

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

    // Tasks (TOUT LE MONDE)
    if (!activeId.startsWith("task:")) return;

    const taskId = Number(activeId.replace("task:", ""));
    const activeTask = tasks.find((t) => Number(t.id) === taskId);
    if (!activeTask) return;

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

    const sourceList = tasks
      .filter((t) => t.column_id === sourceColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const targetList = tasks
      .filter((t) => t.column_id === targetColumnId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const sourceIndex = sourceList.findIndex((t) => t.id === taskId);

    let targetIndex = targetList.length;
    if (overId.startsWith("task:")) {
      const overTaskId = Number(overId.replace("task:", ""));
      const idx = targetList.findIndex((t) => t.id === overTaskId);
      targetIndex = idx >= 0 ? idx : targetList.length;
    }

    let newSource = [...sourceList];
    let newTarget = sourceColumnId === targetColumnId ? newSource : [...targetList];

    const [moved] = newSource.splice(sourceIndex, 1);
    const movedUpdated = { ...moved, column_id: targetColumnId };

    if (sourceColumnId === targetColumnId) {
      newTarget = arrayMove(sourceList, sourceIndex, targetIndex);
    } else {
      newTarget.splice(targetIndex, 0, movedUpdated);
    }

    newSource = newSource.map((t, i) => ({ ...t, position: i }));
    newTarget = newTarget.map((t, i) => ({ ...t, position: i }));

    const previous = tasks;
    setTasks((prev) => {
      const others = prev.filter(
        (t) => t.column_id !== sourceColumnId && t.column_id !== targetColumnId
      );

      return sourceColumnId === targetColumnId
        ? [...others, ...newTarget]
        : [...others, ...newSource, ...newTarget];
    });

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
    sessionStorage.removeItem("token");
    window.location.href = "/";
  };

  const deleteBoard = async () => {
    if (!selectedBoardId) return;
    if (!isOwner) return showToast("Seul le owner peut supprimer le board", "error");

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
      setShowAdmin(false);
      showToast("Board supprimé");
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Impossible de supprimer le board", "error");
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

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Invites badge */}
          <button
            className="btn btn-secondary"
            style={{ width: "auto", position: "relative" }}
            onClick={loadInvites}
            title="Rafraîchir les invitations"
          >
            🔔 Invitations
            {invites.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "rgba(255, 70, 70, 0.95)",
                  color: "white",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                {invites.length}
              </span>
            )}
          </button>

          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {/* Invites panel */}
      {invites.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Invitations en attente</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {loadingInvites ? "Chargement…" : `${invites.length} invitation(s)`}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {invites.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 600 }}>{inv.board_name || `Board #${inv.board_id}`}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    Invitation #{inv.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ width: "auto" }}
                    onClick={() => respondInvite(inv.id, "decline")}
                  >
                    Refuser
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ width: "auto" }}
                    onClick={() => respondInvite(inv.id, "accept")}
                  >
                    Accepter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              borderColor: selectedBoardId === b.id ? "rgba(79, 140, 255, 0.6)" : undefined,
            }}
            onClick={() => loadBoard(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* Actions (tous) */}
      {selectedBoardId && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={() => setShowCreateTask(true)}
            disabled={!selectedBoardId || columnsSorted.length === 0}
          >
            + Task
          </button>

          {!isOwner && (
            <button className="btn btn-secondary" style={{ width: "auto" }} onClick={leaveBoard}>
              🚪 Quitter le board
            </button>
          )}
        </div>
      )}

      {/* Actions owner */}
      {selectedBoardId && isOwner && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            style={{ width: "auto" }}
            onClick={() => setShowAdmin(true)}
          >
            👤 Admin
          </button>

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
        </div>
      )}

      {showAdmin && isOwner && (
        <BoardAdminModal boardId={selectedBoardId} onClose={() => setShowAdmin(false)} />
      )}

      {!selectedBoardId ? (
        <div style={{ opacity: 0.75 }}>Choisis un board pour voir les tâches.</div>
      ) : loadingBoardData ? (
        <div style={{ opacity: 0.75 }}>Chargement du board…</div>
      ) : columnsSorted.length === 0 ? (
        <div style={{ opacity: 0.75 }}>Aucune colonne sur ce board.</div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <SortableContext
            items={columnsSorted.map((c) => `col:${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {/* ✅ colonnes toujours left-to-right, scroll horizontal, jamais en dessous */}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
                paddingBottom: 10,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {columnsSorted.map((col) => (
                <TaskColumn
                  key={col.id}
                  column={col}
                  tasks={tasksByColumnId.get(col.id) || []}
                  isOwner={isOwner}
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
