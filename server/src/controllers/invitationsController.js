const pool = require("../config/db");
const { isBoardOwner, canAccessBoard } = require("../helpers/boardAccess");

// POST /boards/:boardId/invitations  (owner)
exports.createInvitation = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const boardId = Number(req.params.boardId);
    const invitedUserId = Number(req.body?.user_id);

    if (!Number.isInteger(boardId) || !Number.isInteger(invitedUserId)) {
      return res.status(400).json({ message: "Invalid boardId/user_id" });
    }

    const okOwner = await isBoardOwner(boardId, ownerId);
    if (!okOwner) return res.status(403).json({ message: "Owner only" });

    // user exists?
    const u = await pool.query("SELECT id FROM users WHERE id=$1", [invitedUserId]);
    if (!u.rows.length) return res.status(404).json({ message: "User not found" });

    // already member?
    const m = await pool.query(
      "SELECT 1 FROM board_members WHERE board_id=$1 AND user_id=$2",
      [boardId, invitedUserId]
    );
    if (m.rows.length) return res.status(400).json({ message: "User already member" });

    const result = await pool.query(
      `INSERT INTO board_invitations(board_id, invited_user_id, invited_by, status)
       VALUES ($1,$2,$3,'pending')
       ON CONFLICT DO NOTHING
       RETURNING id, board_id, invited_user_id, invited_by, status, created_at`,
      [boardId, invitedUserId, ownerId]
    );

    if (!result.rows.length) {
      return res.status(400).json({ message: "Invitation already pending" });
    }

    const invite = result.rows[0];

    // 🔔 notify invited user (personal room)
    const io = req.app.get("io");
    if (io) io.to(`user:${invitedUserId}`).emit("inviteCreated", invite);

    res.status(201).json(invite);
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /me/invitations (pending)
exports.listMyInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const r = await pool.query(
      `SELECT bi.id, bi.board_id, b.name AS board_name, bi.invited_by, bi.status, bi.created_at
       FROM board_invitations bi
       JOIN boards b ON b.id=bi.board_id
       WHERE bi.invited_user_id=$1 AND bi.status='pending'
       ORDER BY bi.created_at DESC`,
      [userId]
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /invitations/:inviteId/respond  { action: accept|decline }
exports.respondInvitation = async (req, res) => {
  try {
    const userId = req.user.id;
    const inviteId = Number(req.params.inviteId);
    const action = req.body?.action;

    if (!Number.isInteger(inviteId)) return res.status(400).json({ message: "Invalid inviteId" });
    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ message: "Invalid action" });
    }

    const inv = await pool.query(
      `SELECT id, board_id, invited_user_id, status
       FROM board_invitations
       WHERE id=$1 AND invited_user_id=$2`,
      [inviteId, userId]
    );
    if (!inv.rows.length) return res.status(404).json({ message: "Invitation not found" });

    const invite = inv.rows[0];
    if (invite.status !== "pending") return res.status(400).json({ message: "Invitation not pending" });

    await pool.query("BEGIN");

    if (action === "accept") {
      // add member (idempotent)
      await pool.query(
        `INSERT INTO board_members(board_id, user_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [invite.board_id, userId]
      );

      await pool.query(
        `UPDATE board_invitations
         SET status='accepted', responded_at=NOW()
         WHERE id=$1`,
        [inviteId]
      );
    } else {
      await pool.query(
        `UPDATE board_invitations
         SET status='declined', responded_at=NOW()
         WHERE id=$1`,
        [inviteId]
      );
    }

    await pool.query("COMMIT");

    // 🔔 notify board room + user
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${userId}`).emit("inviteResponded", { inviteId, action, board_id: invite.board_id });
      io.to(`board:${invite.board_id}`).emit("memberChanged", { user_id: userId, action });
    }

    res.json({ message: "OK", action });
  } catch (e) {
    await pool.query("ROLLBACK").catch(() => {});
    console.log(e);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /boards/:boardId/members/me
exports.leaveBoard = async (req, res) => {
  try {
    const userId = req.user.id;
    const boardId = Number(req.params.boardId);
 
    if (!Number.isInteger(boardId)) return res.status(400).json({ message: "Invalid boardId" });

    // owner can't leave (simple rule)
    const owner = await pool.query("SELECT owner_id FROM boards WHERE id=$1", [boardId]);
    if (!owner.rows.length) return res.status(404).json({ message: "Board not found" });
    if (Number(owner.rows[0].owner_id) === Number(userId)) {
      return res.status(400).json({ message: "Owner cannot leave the board" });
    }

    const r = await pool.query(
      `DELETE FROM board_members
       WHERE board_id=$1 AND user_id=$2
       RETURNING user_id`,
      [boardId, userId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Not a member" });

    const io = req.app.get("io");
    if (io) io.to(`board:${boardId}`).emit("memberChanged", { user_id: userId, action: "left" });

    res.json({ message: "Left" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Server error" });
  }
};
