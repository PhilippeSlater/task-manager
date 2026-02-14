const pool = require("../config/db");

// GET /boards
exports.listBoards = async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const r = await pool.query(
      `SELECT DISTINCT b.id, b.name, b.owner_id, b.created_at
       FROM boards b
       LEFT JOIN board_members bm ON bm.board_id = b.id
       WHERE b.owner_id=$1 OR bm.user_id=$1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("BOARDS listBoards:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /boards
exports.createBoard = async (req, res) => {
  const userId = Number(req.user.id);
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "name required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const b = await client.query(
      `INSERT INTO boards (name, owner_id)
       VALUES ($1,$2)
       RETURNING id, name, owner_id, created_at`,
      [name, userId]
    );

    const board = b.rows[0];

    // owner membre (facultatif mais pratique)
    await client.query(
      `INSERT INTO board_members (board_id, user_id, role)
       VALUES ($1,$2,'owner')
       ON CONFLICT DO NOTHING`,
      [board.id, userId]
    );

    await client.query("COMMIT");
    res.status(201).json(board);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("BOARDS createBoard:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
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

exports.getMyRole = async (req, res) => {
  const ownerId = Number(req.user.id);
  const boardId = Number(req.params.boardId);

  const r = await pool.query(
    `
    SELECT
      CASE
        WHEN b.owner_id = $2 THEN 'owner'
        WHEN EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id=$1 AND bm.user_id=$2) THEN 'member'
        ELSE NULL
      END AS role
    FROM boards b
    WHERE b.id=$1
    `,
    [boardId, ownerId]
  );

  const role = r.rows?.[0]?.role;
  if (!role) return res.status(404).json({ message: "Board not found" });

  res.json({ role });
};