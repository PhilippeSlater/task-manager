const router = require("express").Router();
const controller = require("../controllers/boards");

router.get("/", controller.listBoards);
router.post("/", controller.createBoard);
router.delete("/:id", controller.deleteBoard);

module.exports = router;
