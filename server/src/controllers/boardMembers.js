const pool = require("../config/db");
const { isBoardOwner } = require("../helpers/boardAccess");

// GET /boards/:boardId/members (owner only)
exports.listMembers = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });

    const ok = await isBoardOwner(boardId, ownerId);
    if (!ok) return res.status(403).json({ message: "Owner only" });

    const r = await pool.query(
      `SELECT u.id, u.email, bm.role, bm.created_at
       FROM board_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id=$1
       ORDER BY (bm.role='owner') DESC, u.email ASC`,
      [boardId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("MEMBERS listMembers:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /boards/:boardId/members { email } (owner only)
exports.addMemberByEmail = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });
    if (!email) return res.status(400).json({ message: "email required" });

    const ok = await isBoardOwner(boardId, ownerId);
    if (!ok) return res.status(403).json({ message: "Owner only" });

    // user exists?
    const u = await pool.query(
      `SELECT id, email FROM users WHERE lower(email)=lower($1)`,
      [email]
    );
    if (!u.rows.length) return res.status(404).json({ message: "User not found" });

    const invitedUserId = Number(u.rows[0].id);

    // already member?
    const m = await pool.query(
      `SELECT 1 FROM board_members WHERE board_id=$1 AND user_id=$2`,
      [boardId, invitedUserId]
    );
    if (m.rows.length) return res.status(400).json({ message: "User already member" });

    // create invitation (pending) - prevent duplicates
    const r = await pool.query(
      `INSERT INTO board_invitations(board_id, invited_user_id, invited_by, status)
       VALUES ($1,$2,$3,'pending')
       ON CONFLICT DO NOTHING
       RETURNING id, board_id, invited_user_id, invited_by, status, created_at`,
      [boardId, invitedUserId, ownerId]
    );

    if (!r.rows.length) {
      return res.status(400).json({ message: "Invitation already pending" });
    }

    const invite = r.rows[0];

    // notify invited user
    const io = req.app.get("io");
    if (io) io.to(`user:${invitedUserId}`).emit("inviteCreated", invite);

    // renvoyer aussi l'email (pratique UI)
    res.status(201).json({ ...invite, email: u.rows[0].email, id: invitedUserId });
  } catch (err) {
    console.error("MEMBERS addMemberByEmail(invite):", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /boards/:boardId/members/:userId (owner only)
exports.removeMember = async (req, res) => {
  try {
    const ownerId = Number(req.user.id);
    const boardId = Number(req.params.boardId);
    const userId = Number(req.params.userId);

    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid board id" });
    if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid user id" });

    const ok = await isBoardOwner(boardId, ownerId);
    if (!ok) return res.status(403).json({ message: "Owner only" });

    // ne pas retirer l'owner de la liste si tu utilises role=owner
    const r0 = await pool.query(
      `SELECT role FROM board_members WHERE board_id=$1 AND user_id=$2`,
      [boardId, userId]
    );
    if (!r0.rows.length) return res.status(404).json({ message: "Member not found" });
    if (r0.rows[0].role === "owner") return res.status(400).json({ message: "Cannot remove owner" });

    await pool.query(
      `DELETE FROM board_members WHERE board_id=$1 AND user_id=$2`,
      [boardId, userId]
    );

    res.json({ message: "Removed" });
  } catch (err) {
    console.error("MEMBERS removeMember:", err);
    res.status(500).json({ message: "Server error" });
  }
};
