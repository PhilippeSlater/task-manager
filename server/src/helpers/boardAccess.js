// helpers/boardAccess.js (ou directement dans controllers)
const pool = require("../config/db");

async function canAccessBoard(boardId, userId) {
  const r = await pool.query(
    `SELECT 1
     FROM boards b
     WHERE b.id=$1 AND (b.owner_id=$2 OR EXISTS (
       SELECT 1 FROM board_members bm WHERE bm.board_id=b.id AND bm.user_id=$2
     ))`,
    [boardId, userId]
  );
  return r.rows.length > 0;
}

async function isBoardOwner(boardId, userId) {
  const r = await pool.query(
    `SELECT 1 FROM boards WHERE id=$1 AND owner_id=$2`,
    [boardId, userId]
  );
  return r.rows.length > 0;
}

module.exports = { canAccessBoard, isBoardOwner };
