const request = require("supertest");
const app = require("../src/app");

let token;
let boardId;

let colAId;
let colBId;

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
    boardId = Number(res.body.id);
    expect(Number.isInteger(boardId)).toBe(true);
  });

  test("GET /boards -> includes created board", async () => {
    const res = await request(app)
      .get("/boards")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((b) => Number(b.id) === boardId)).toBe(true);
  });

  // ---------- COLUMNS ----------
  test("GET /boards/:boardId/columns -> list columns", async () => {
    const res = await request(app)
      .get(`/boards/${boardId}/columns`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // si ton backend crée des colonnes par défaut à la création du board,
    // on en prend deux. Sinon, on les créera dans le test suivant.
    if (res.body.length >= 2) {
      colAId = Number(res.body[0].id);
      colBId = Number(res.body[1].id);
    }
  });

  test("POST /boards/:boardId/columns -> create column (if needed)", async () => {
    // si pas de colonnes par défaut, on en crée 2
    if (!colAId) {
      const resA = await request(app)
        .post(`/boards/${boardId}/columns`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Todo", position: 0 });

      expect(resA.status).toBe(201);
      colAId = Number(resA.body.id);
      expect(Number.isInteger(colAId)).toBe(true);
    }

    if (!colBId) {
      const resB = await request(app)
        .post(`/boards/${boardId}/columns`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Doing", position: 1 });

      expect(resB.status).toBe(201);
      colBId = Number(resB.body.id);
      expect(Number.isInteger(colBId)).toBe(true);
    }
  });

  test("PATCH /boards/:boardId/columns/:columnId -> rename column", async () => {
    const res = await request(app)
      .patch(`/boards/${boardId}/columns/${colAId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "À faire" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("À faire");
  });

  test("PATCH /boards/:boardId/columns/reorder -> reorder columns", async () => {
    // ordre inverse
    const res = await request(app)
      .patch(`/boards/${boardId}/columns/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ columnIds: [colBId, colAId] });

    expect(res.status).toBe(200);
  });

  test("GET /boards/:boardId/columns -> order reflects reorder", async () => {
    const res = await request(app)
      .get(`/boards/${boardId}/columns`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // si tu relies l'ordre uniquement à "position", on vérifie
    const idsInOrder = res.body.map((c) => Number(c.id));
    expect(idsInOrder[0]).toBe(colBId);
    expect(idsInOrder[1]).toBe(colAId);
  });

  // ---------- TASKS ----------
  test("POST /tasks -> create task (with column_id)", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        board_id: boardId,
        column_id: colAId,
        title: "Task 1",
        description: "Hello",
        position: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    taskId = Number(res.body.id);

    expect(Number.isInteger(taskId)).toBe(true);
    expect(Number(res.body.board_id)).toBe(boardId);
    expect(Number(res.body.column_id)).toBe(colAId);
  });

  test("GET /tasks/board/:boardId -> list tasks", async () => {
    const res = await request(app)
      .get(`/tasks/board/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t) => Number(t.id) === taskId)).toBe(true);
  });

  test("PATCH /tasks/:id -> move task to another column", async () => {
    const res = await request(app)
      .patch(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ column_id: colBId, position: 0 });

    expect(res.status).toBe(200);
    expect(Number(res.body.column_id)).toBe(colBId);
    expect(Number(res.body.position)).toBe(0);
  });

  test("DELETE /tasks/:id", async () => {
    const res = await request(app)
      .delete(`/tasks/${taskId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // (Optionnel) DELETE column: si ton DB empêche delete si tasks existent,
  // ça passera maintenant que la task est supprimée.
  test("DELETE /boards/:boardId/columns/:columnId", async () => {
    const res = await request(app)
      .delete(`/boards/${boardId}/columns/${colBId}`)
      .set("Authorization", `Bearer ${token}`);

    // selon ton implémentation: 200 ou 204
    expect([200, 204]).toContain(res.status);
  });

  test("DELETE /boards/:id", async () => {
    const res = await request(app)
      .delete(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
