const request = require("supertest");
const app = require("../src/app");

let token;
let boardId;
let taskId;

describe("API integration", () => {
  test("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("POST /auth/register", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@test.com", password: "password123" });

    expect([200, 201]).toContain(res.status);
  });

  test("POST /auth/login -> token", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "a@test.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
  });

  test("GET /boards (auth required)", async () => {
    const res = await request(app).get("/boards");
    expect([401, 403]).toContain(res.status);
  });

  test("POST /boards -> create", async () => {
    const res = await request(app)
      .post("/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "My board" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    boardId = res.body.id;
  });

  test("GET /boards -> includes created board", async () => {
    const res = await request(app)
      .get("/boards")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((b) => b.id === boardId)).toBe(true);
  });

  test("POST /tasks -> create task", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        board_id: boardId,
        column_id: column_id,
        title: "Task 1",
        description: "Hello",
        status: "todo",
        position: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    taskId = res.body.id;
  });

  test("GET /tasks/board/:boardId -> list tasks", async () => {
    const res = await request(app)
      .get(`/tasks/board/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t) => t.id === taskId)).toBe(true);
  });

  test("PATCH /tasks/:id -> move task", async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "doing", position: 1 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("doing");
  });

  test("DELETE /tasks/:id", async () => {
    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test("DELETE /boards/:id", async () => {
    const res = await request(app)
      .delete(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
