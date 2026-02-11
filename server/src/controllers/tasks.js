const pool = require("../config/db");

// Make sure its the owner
async function assertBoardOwnership(boardId, ownerId) {
  const b = await pool.query(
    "SELECT id FROM boards WHERE id=$1 AND owner_id=$2",
    [boardId, ownerId]
  );
  return b.rows.length > 0;
}

// GET /tasks/board/:boardId
exports.listTasksByBoard = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.boardId);

    const ok = await assertBoardOwnership(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const result = await pool.query(
      "SELECT id,title,description,status,position,created_at FROM tasks WHERE board_id=$1 ORDER BY status, position, id",
      [boardId]
    );

    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /tasks
exports.createTask = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { board_id, title, description, status, position } = req.body || {};

    if (!board_id || !title)
      return res.status(400).json({ message: "board_id and title required" });

    const ok = await assertBoardOwnership(Number(board_id), ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const result = await pool.query(
      `INSERT INTO tasks (board_id, title, description, status, position, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, board_id, title, description, status, position, created_at`,
      [
        board_id,
        title,
        description || null,
        status || "todo",
        Number.isInteger(position) ? position : 0,
        ownerId,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const taskId = Number(req.params.id);
    const { title, description, status, position } = req.body || {};

    // Make sur its the owner
    const result = await pool.query(
      `UPDATE tasks t
       SET title = COALESCE($1, t.title),
           description = COALESCE($2, t.description),
           status = COALESCE($3, t.status),
           position = COALESCE($4, t.position)
       FROM boards b
       WHERE t.id=$5 AND t.board_id=b.id AND b.owner_id=$6
       RETURNING t.id, t.board_id, t.title, t.description, t.status, t.position, t.created_at`,
      [
        title ?? null,
        description ?? null,
        status ?? null,
        position ?? null,
        taskId,
        ownerId,
      ]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Task not found" });

    res.json(result.rows[0]);
  } catch {
    console.error("Boards error:", err);  
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const taskId = Number(req.params.id);

    const result = await pool.query(
      `DELETE FROM tasks t
       USING boards b
       WHERE t.id=$1 AND t.board_id=b.id AND b.owner_id=$2
       RETURNING t.id`,
      [taskId, ownerId]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
