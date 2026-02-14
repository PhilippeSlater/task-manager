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

    if (!Number.isInteger(boardId) || !Number.isInteger(columnId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const okCol = await assertColumnInBoard(columnId, boardId);
    if (!okCol) return res.status(404).json({ message: "Column not found" });

    const { name, position } = req.body || {};
    const patchName = name !== undefined ? String(name).trim() : null;
    const patchPos = Number.isInteger(position) ? position : null;

    if (patchName !== null && patchName.length === 0) {
      return res.status(400).json({ message: "name cannot be empty" });
    }

    const r = await pool.query(
      `UPDATE columns
       SET name = COALESCE($1, name),
           position = COALESCE($2, position)
       WHERE id=$3 AND board_id=$4
       RETURNING id, board_id, name, position`,
      [patchName, patchPos, columnId, boardId]
    );

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

    if (!Number.isInteger(boardId) || !Number.isInteger(columnId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const okCol = await assertColumnInBoard(columnId, boardId);
    if (!okCol) return res.status(404).json({ message: "Column not found" });

    // Rule: refuse delete if tasks exist in that column
    const t = await pool.query(
      "SELECT 1 FROM tasks WHERE board_id=$1 AND column_id=$2 LIMIT 1",
      [boardId, columnId]
    );
    if (t.rows.length) {
      return res.status(409).json({
        message: "Column not empty. Move/delete tasks before deleting this column.",
      });
    }

    await pool.query("DELETE FROM columns WHERE id=$1 AND board_id=$2", [columnId, boardId]);

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnDeleted", { id: columnId, board_id: boardId });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("COLUMNS deleteColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};
