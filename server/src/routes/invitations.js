// routes/invitations.js
const router = require("express").Router();
const c = require("../controllers/invitationsController");

router.get("/me/invitations", c.listMyInvitations);
router.post("/invitations/:inviteId/respond", c.respondInvitation);

module.exports = router;
