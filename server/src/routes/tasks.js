const router = require("express").Router();
const controller = require("../controllers/tasks");

router.get("/board/:boardId", controller.listTasksByBoard);
router.post("/", controller.createTask);
router.patch("/:id", controller.updateTask);
router.delete("/:id", controller.deleteTask);

module.exports = router;
