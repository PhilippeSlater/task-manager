const router = require("express").Router();
const controller = require("../controllers/boards");
const columns = require("../controllers/columns");

router.get("/", controller.listBoards);
router.post("/", controller.createBoard);
router.delete("/:id", controller.deleteBoard);
// /boards/:boardId/columns
router.get("/:boardId/columns", columns.listColumns);
router.post("/:boardId/columns", columns.createColumn);

module.exports = router;
