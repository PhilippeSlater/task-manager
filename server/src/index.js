require("dotenv").config();
const express = require("express");
const pool = require("./config/db");

const auth = require("./middleware/auth");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = 5000;

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/boards", auth, require("./routes/boards"));
app.use("/tasks", auth, require("./routes/tasks"));

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
