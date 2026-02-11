require("dotenv").config();
const express = require("express");
const pool = require("./config/db");

const app = express();
const PORT = 5000;
console.log("DATABASE_URL:", process.env.DATABASE_URL);
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
