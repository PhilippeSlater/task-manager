// server/src/app.js
if (process.env.NODE_ENV !== "test") {
  require("dotenv").config();
}
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const boardsRoutes = require("./routes/boards");
const tasksRoutes = require("./routes/tasks");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
const auth = require("./middleware/auth"); 
app.use("/auth", authRoutes);
app.use("/boards", auth, boardsRoutes);
app.use("/tasks", auth, tasksRoutes);

// Health
app.get("/health", (req, res) => res.json({ status: "ok" }));

module.exports = app;
