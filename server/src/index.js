require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
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

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/boards", auth, require("./routes/boards"));
app.use("/tasks", auth, require("./routes/tasks"));

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("API running");
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
