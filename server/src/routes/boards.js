const router = require("express").Router();
const controller = require("../controllers/boards");
const columns = require("../controllers/columns");

router.get("/", controller.listBoards);
router.post("/", controller.createBoard);
router.delete("/:id", controller.deleteBoard);

// columns inside a board
router.get("/:boardId/columns", columns.listColumns);
router.post("/:boardId/columns", columns.createColumn);
router.patch("/:boardId/columns/reorder", columns.reorderColumns);
router.patch("/:boardId/columns/:columnId", columns.updateColumn);
router.delete("/:boardId/columns/:columnId", columns.deleteColumn);


module.exports = router;
