const router = require("express").Router();
const boards = require("../controllers/boards");
const columns = require("../controllers/columns");
const members = require("../controllers/boardMembers");
const c = require("../controllers/invitationsController");


router.get("/", boards.listBoards);
router.get("/:boardId/me", boards.getMyRole);
router.post("/", boards.createBoard);
router.post("/:boardId/invitations", c.createInvitation);
router.delete("/:id", boards.deleteBoard);
router.delete("/:boardId/members/me", c.leaveBoard);

// columns
router.get("/:boardId/columns", columns.listColumns);
router.post("/:boardId/columns", columns.createColumn);
router.patch("/:boardId/columns/reorder", columns.reorderColumns);
router.patch("/:boardId/columns/:columnId", columns.updateColumn);
router.delete("/:boardId/columns/:columnId", columns.deleteColumn);

// members (admin modal)
router.get("/:boardId/members", members.listMembers);
router.post("/:boardId/members", members.addMemberByEmail);
router.delete("/:boardId/members/:userId", members.removeMember);

module.exports = router;
