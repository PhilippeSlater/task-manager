require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = 5000;

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("board:join", (boardId) => {
    const room = `board-${boardId}`;
    socket.join(room);
    // console.log(`${socket.id} joined ${room}`);
  });

  socket.on("board:leave", (boardId) => {
    const room = `board-${boardId}`;
    socket.leave(room);
    // console.log(`${socket.id} left ${room}`);
  });

  socket.on("disconnect", () => {
    // console.log("socket disconnected", socket.id);
  });
});

app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
});

// Limit the resquest rate to avoid brute force
app.use("/auth", authLimiter);
app.use("/auth", authRoutes);
app.use("/boards", auth, require("./routes/boards"));
app.use("/tasks", auth, require("./routes/tasks"));

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("API running");
});

// Add simple health check
app.get("/health", async (_, res) => {
  res.json({ status: "ok", time: new Date() });
});

// Test connexion DB
pool.query("SELECT NOW()")
  .then((res) => {
    console.log("DB Connected:", res.rows[0]);
  })
  .catch((err) => {
    console.error("DB Connection Error:", err);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
