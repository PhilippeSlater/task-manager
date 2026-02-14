const {canAccessBoard} = require("../helpers/boardAccess");

const pool = require("../config/db");

// GET /tasks/board/:boardId
exports.listTasksByBoard = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.boardId);

    const ok = await canAccessBoard(boardId, ownerId);
    if (!ok) return res.status(404).json({ message: "Board not found" });

    const result = await pool.query(
      `SELECT id, board_id, column_id, title, description, position, created_at
       FROM tasks
       WHERE board_id=$1
       ORDER BY column_id NULLS FIRST, position ASC`,
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
    const { board_id, column_id, title, description, position } = req.body || {};

    const columnId = Number(column_id);
    if (!Number.isInteger(columnId)) return res.status(400).json({ message: "column_id required" });

    if (!board_id || !title)
      return res.status(400).json({ message: "board_id and title required" });

    const okBoard = await canAccessBoard(Number(board_id), ownerId);
    if (!okBoard) return res.status(404).json({ message: "Board not found" });

    const okCol = await pool.query("SELECT 1 FROM columns WHERE id=$1 AND board_id=$2", [columnId, board_id]);
    if (!okCol.rows.length) return res.status(400).json({ message: "Invalid column_id for this board" });

    const pos = Number.isInteger(position) ? position : 0;

    const result = await pool.query(
      `INSERT INTO tasks (board_id, column_id, title, description, position, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, board_id, column_id, title, description, position, created_at`,
      [board_id, columnId, title.trim(), description || null, pos, ownerId]
    );

    const newTask = result.rows[0];
    const io = req.app.get("io");
    if (io) io.to(`board:${newTask.board_id}`).emit("taskCreated", newTask);

    res.status(201).json(newTask); 
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const taskId = Number(req.params.id);
    const { title, description, column_id, position } = req.body || {};

    const t0 = await pool.query(
      `SELECT t.id, t.board_id
       FROM tasks t
       JOIN boards b ON b.id=t.board_id
       WHERE t.id=$1 AND b.owner_id=$2`,
      [taskId, ownerId]
    );
    if (!t0.rows.length) return res.status(404).json({ message: "Task not found" });

    const boardId = t0.rows[0].board_id;

    let colId = null;
    if (column_id !== undefined) {
      const cid = Number(column_id);
      if (!Number.isInteger(cid)) return res.status(400).json({ message: "Invalid column_id" });

      const okCol = await pool.query("SELECT 1 FROM columns WHERE id=$1 AND board_id=$2", [cid, boardId]);
      if (!okCol.rows.length) return res.status(400).json({ message: "Invalid column_id for this board" });

      colId = cid;
    }

    const patchTitle = typeof title === "string" ? title.trim() : null;
    const patchDesc = typeof description === "string" ? description : null;
    const patchPos = Number.isInteger(position) ? position : null;

    // Make sur its the owner
    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           column_id = COALESCE($3, column_id),
           position = COALESCE($4, position)
       WHERE id=$5
       RETURNING id, board_id, column_id, title, description, position, created_at, updated_at`,
      [patchTitle || null, patchDesc, colId, patchPos, taskId]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Task not found" });

    const updatedTask = result.rows[0];
    const io = req.app.get("io")
    if (io) io.to(`board:${updatedTask.board_id}`).emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch {
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

    const deleted = result.rows[0];
    const io = req.app.get("io");
    if (io) io.to(`board:${deleted.board_id}`).emit("taskDeleted", { id: deleted.id, board_id: deleted.board_id });

    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
