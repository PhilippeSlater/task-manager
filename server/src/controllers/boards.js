const pool = require("../config/db");

// GET /boards
exports.listBoards = async (req, res) => {
  try {
    //Make sure only the owner can get the board
    const ownerId = req.user.id;
    const result = await pool.query(
      "SELECT id, name, created_at FROM boards WHERE owner_id=$1 ORDER BY created_at DESC",
      [ownerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /boards
exports.createBoard = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: "name required" });

    const result = await pool.query(
      "INSERT INTO boards (name, owner_id) VALUES ($1,$2) RETURNING id,name,created_at",
      [name, ownerId]
    );
    const newTask = result.rows[0];
    const io = req.app.get("io");
    if (io) io.emit("boardCreated", newTask);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /boards/:id
exports.deleteBoard = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.id);

    const result = await pool.query(
      "DELETE FROM boards WHERE id=$1 AND owner_id=$2 RETURNING id",
      [boardId, ownerId]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Board not found" });

    const deleted = result.rows[0];
    const io = req.app.get("io");
    if (io) io.emit("boardDeleted", { id: deleted.id, name: deleted.name });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
