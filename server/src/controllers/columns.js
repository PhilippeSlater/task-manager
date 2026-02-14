const pool  = require("../config/db");

async function assertBoardOwnership(boardId, ownerId) {
  const r = await pool.query(
    "SELECT id FROM boards WHERE id=$1 AND owner_id=$2",
    [boardId, ownerId]
  );
  return r.rows.length > 0;
}

// GET /boards/:boardId/columns
exports.listColumns = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.boardId);
    if (!Number.isInteger(boardId))
      return res.status(400).json({ message: "Invalid board id" });

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const r = await pool.query(
      "SELECT id, board_id, name, position FROM columns WHERE board_id=$1 ORDER BY position ASC",
      [boardId]
    );



    res.json(r.rows);
  } catch (err) {   
    res.status(500).json({ message: "Server error" });
  }
};

// POST /boards/:boardId/columns  body: { name }
exports.createColumn = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.boardId);
    const { name } = req.body || {};

    if (!Number.isInteger(boardId))
      return res.status(400).json({ message: "Invalid board id" });
    if (!name || !name.trim())
      return res.status(400).json({ message: "name required" });

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    // next position
    const max = await pool.query(
      "SELECT COALESCE(MAX(position), -1) AS max FROM columns WHERE board_id=$1",
      [boardId]
    );
    const position = Number(max.rows[0].max) + 1;

    const r = await pool.query(
      `INSERT INTO columns (board_id, name, position)
       VALUES ($1,$2,$3)
       RETURNING id, board_id, name, position`,
      [boardId, name.trim(), position]
    );

    const col = r.rows[0];

    // realtime (optionnel)
    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnCreated", col);

    res.status(201).json(col);
  } catch (err) {
    console.error("COLUMNS createColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /columns/:id  body: { name?, position? }
exports.updateColumn = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const columnId = Number(req.params.id);
    const { name, position } = req.body || {};

    if (!Number.isInteger(columnId))
      return res.status(400).json({ message: "Invalid column id" });

    // vérifier ownership via join columns->boards
    const col = await pool.query(
      `SELECT c.id, c.board_id
       FROM columns c
       JOIN boards b ON b.id=c.board_id
       WHERE c.id=$1 AND b.owner_id=$2`,
      [columnId, ownerId]
    );
    if (!col.rows.length)
      return res.status(404).json({ message: "Column not found" });

    const boardId = col.rows[0].board_id;

    const patchName = typeof name === "string" ? name.trim() : null;
    const patchPos = Number.isInteger(position) ? position : null;

    if (patchName === "" && patchPos === null)
      return res.status(400).json({ message: "Nothing to update" });

    const r = await pool.query(
      `UPDATE columns
       SET name = COALESCE($1, name),
           position = COALESCE($2, position)
       WHERE id=$3
       RETURNING id, board_id, name, position`,
      [patchName || null, patchPos, columnId]
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

// DELETE /columns/:id
exports.deleteColumn = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const columnId = Number(req.params.id);
    if (!Number.isInteger(columnId))
      return res.status(400).json({ message: "Invalid column id" });

    // trouver board_id + ownership
    const col = await pool.query(
      `SELECT c.id, c.board_id
       FROM columns c
       JOIN boards b ON b.id=c.board_id
       WHERE c.id=$1 AND b.owner_id=$2`,
      [columnId, ownerId]
    );
    if (!col.rows.length)
      return res.status(404).json({ message: "Column not found" });

    const boardId = col.rows[0].board_id;

    // refuser si la colonne a des tasks (simple)
    const hasTasks = await pool.query(
      "SELECT 1 FROM tasks WHERE column_id=$1 LIMIT 1",
      [columnId]
    );
    if (hasTasks.rows.length)
      return res.status(409).json({ message: "Column not empty" });

    await pool.query("DELETE FROM columns WHERE id=$1", [columnId]);

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("columnDeleted", { id: columnId, board_id: boardId });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("COLUMNS deleteColumn:", err);
    res.status(500).json({ message: "Server error" });
  }
};
