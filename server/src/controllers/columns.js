const pool = require("../config/db");

// owner check
async function assertBoardOwnership(boardId, ownerId) {
  const r = await pool.query(
    "SELECT id FROM boards WHERE id=$1 AND owner_id=$2",
    [boardId, ownerId]
  );
  return r.rows.length > 0;
}

// column belongs to board
async function assertColumnInBoard(columnId, boardId) {
  const r = await pool.query(
    "SELECT id FROM columns WHERE id=$1 AND board_id=$2",
    [columnId, boardId]
  );
  return r.rows.length > 0;
}

// GET /boards/:boardId/columns
exports.listColumns = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);

    if (!Number.isInteger(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const r = await pool.query(
      `SELECT id, board_id, name, position
       FROM columns
       WHERE board_id=$1
       ORDER BY position ASC`,
      [boardId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("COLUMNS listColumns:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /boards/:boardId/columns
exports.createColumn = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    const { name, position } = req.body || {};

    if (!Number.isInteger(boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const n = String(name || "").trim();
    if (!n) return res.status(400).json({ message: "name required" });

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const pos = Number.isInteger(position) ? position : 0;

    const r = await pool.query(
      `INSERT INTO columns (board_id, name, position)
       VALUES ($1,$2,$3)
       RETURNING id, board_id, name, position`,
      [boardId, n, pos]
    );

    const created = r.rows[0];

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnCreated", created);

    res.status(201).json(created);
  } catch (err) {
    console.error("COLUMNS createColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /boards/:boardId/columns/:columnId
exports.updateColumn = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });
    if (!Number.isInteger(columnId)) return res.status(400).json({ message: "Invalid column id" });

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const { name, position } = req.body || {};
    const patchName = typeof name === "string" ? name.trim() : null;
    const patchPos = Number.isInteger(position) ? position : null;

    if (patchName === null && patchPos === null) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const r = await pool.query(
      `UPDATE columns
       SET name = COALESCE($1, name),
           position = COALESCE($2, position)
       WHERE id=$3 AND board_id=$4
       RETURNING id, board_id, name, position`,
      [patchName, patchPos, columnId, boardId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Column not found" });

    const updated = r.rows[0];

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnUpdated", updated);

    res.json(updated);
  } catch (err) {
    console.error("COLUMNS updateColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /boards/:boardId/columns/:columnId
exports.deleteColumn = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);

    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });
    if (!Number.isInteger(columnId)) return res.status(400).json({ message: "Invalid column id" });

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    // si tu veux empêcher delete si tasks existent -> check ici
    const r = await pool.query(
      "DELETE FROM columns WHERE id=$1 AND board_id=$2 RETURNING id, board_id",
      [columnId, boardId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Column not found" });

    const deleted = r.rows[0];

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnDeleted", { id: deleted.id, board_id: deleted.board_id });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("COLUMNS deleteColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.reorderColumns = async (req, res) => {
  const ownerId = Number(req.user.id);
  const boardId = Number(req.params.boardId);
  const { columnIds } = req.body || {};
  
  if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });
  if (!Array.isArray(columnIds) || columnIds.length === 0) {
    return res.status(400).json({ message: "columnIds required" });
  }

  const ids = columnIds.map(Number);
  if (ids.some((x) => !Number.isInteger(x))) {
    return res.status(400).json({ message: "Invalid column id" });
  }

  const ok = await assertBoardOwnership(boardId, ownerId);
  if (!ok) return res.status(404).json({ message: "Board not found" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // (optionnel mais recommandé) valider que toutes les colonnes appartiennent au board
    const check = await client.query(
      `SELECT id FROM columns WHERE board_id=$1 AND id = ANY($2::int[])`,
      [boardId, ids]
    );
    if (check.rows.length !== ids.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Some columns do not belong to this board" });
    }

    // Phase 1: déplacer hors plage pour éviter uq(board_id, position)
    await client.query(
      `UPDATE columns
       SET position = position + 1000
       WHERE board_id=$1`,
      [boardId]
    );

    // Phase 2: appliquer l'ordre demandé
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE columns
         SET position=$1
         WHERE board_id=$2 AND id=$3`,
        [i, boardId, ids[i]]
      );
    }

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnsReordered", { board_id: boardId, columnIds: ids });

    return res.json({ message: "Reordered" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("COLUMNS reorderColumns:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};