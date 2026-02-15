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
    const userId = Number(req.user.id);
    const taskId = Number(req.params.id);
    const { title, description, column_id, position } = req.body || {};

    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    // 1) Trouver le board de la task
    const t0 = await pool.query(
      `SELECT id, board_id FROM tasks WHERE id=$1`,
      [taskId]
    );
    if (!t0.rows.length) return res.status(404).json({ message: "Task not found" });

    const boardId = Number(t0.rows[0].board_id);

    // 2) Permission : owner OU member
    const ok = await canAccessBoard(boardId, userId);
    if (!ok) return res.status(404).json({ message: "Task not found" }); // volontairement 404

    // 3) Si on change column_id, valider que la colonne appartient au board
    let colId = null;
    if (column_id !== undefined) {
      const cid = Number(column_id);
      if (!Number.isInteger(cid)) return res.status(400).json({ message: "Invalid column_id" });

      const okCol = await pool.query(
        "SELECT 1 FROM columns WHERE id=$1 AND board_id=$2",
        [cid, boardId]
      );
      if (!okCol.rows.length) {
        return res.status(400).json({ message: "Invalid column_id for this board" });
      }
      colId = cid;
    }

    const patchTitle = typeof title === "string" ? title.trim() : null;
    const patchDesc  = typeof description === "string" ? description : null;
    const patchPos   = Number.isInteger(position) ? position : null;

    if (patchTitle === null && patchDesc === null && colId === null && patchPos === null) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           column_id = COALESCE($3, column_id),
           position = COALESCE($4, position),
           updated_at = NOW()
       WHERE id=$5
       RETURNING id, board_id, column_id, title, description, position, created_at, updated_at`,
      [patchTitle, patchDesc, colId, patchPos, taskId]
    );

    const updatedTask = result.rows[0];

    const io = req.app.get("io");
    if (io) io.to(`board:${updatedTask.board_id}`).emit("taskUpdated", updatedTask);

    res.json(updatedTask);
  } catch (err) {
    console.error("TASKS updateTask:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// DELETE /tasks/:id  (owner OR member)
exports.deleteTask = async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const taskId = Number(req.params.id);

    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ message: "Invalid task id" });
    }

    // 1) Trouver board_id de la task
    const t0 = await pool.query(
      `SELECT id, board_id FROM tasks WHERE id=$1`,
      [taskId]
    );
    if (!t0.rows.length) return res.status(404).json({ message: "Task not found" });

    const boardId = Number(t0.rows[0].board_id);

    // 2) Permission: owner OU member
    const ok = await canAccessBoard(boardId, userId);
    if (!ok) return res.status(404).json({ message: "Task not found" });

    // 3) Delete
    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id=$1
       RETURNING id, board_id`,
      [taskId]
    );

    if (!result.rows.length) return res.status(404).json({ message: "Task not found" });

    const deleted = result.rows[0];

    const io = req.app.get("io");
    if (io) io.to(`board:${deleted.board_id}`).emit("taskDeleted", { id: deleted.id, board_id: deleted.board_id });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("TASKS deleteTask:", err);
    res.status(500).json({ message: "Server error" });
  }
};


