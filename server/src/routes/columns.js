const router = require("express").Router();
const controller = require("../controllers/columns");

// /columns/:id
router.patch("/columns/:id", controller.updateColumn);
router.delete("/columns/:id", controller.deleteColumn);

module.exports = router;
