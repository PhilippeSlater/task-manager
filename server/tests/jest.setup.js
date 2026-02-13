process.env.NODE_ENV = "test";
require("dotenv").config({ path: ".env.test" });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "setup.sql"), "utf8");
  await pool.query(sql);
});

afterAll(async () => {
  await pool.end();
});
