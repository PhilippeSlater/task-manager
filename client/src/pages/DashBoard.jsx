import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    api.get("/boards")
        .then((res) => setBoards(res.data))
        .catch((err) => {
            console.log(err);
            // Add error logic here
            // 401 -> redirect to login
            window.location.href = "/login";
        });
  }, []);

  const loadTasks = (boardId) => {
    api.get(`/tasks/board/${boardId}`).then((res) => setTasks(res.data));
  };

  return (
    <div>
      <h1>Boards</h1>

      {boards.map((b) => (
        <button key={b.id} onClick={() => loadTasks(b.id)}>
          {b.name}
        </button>
      ))}

      <h2>Tasks</h2>

      <div style={{ display: "flex", gap: 20 }}>
        {["todo", "doing", "done"].map((s) => (
          <div key={s}>
            <h3>{s}</h3>
            {tasks.filter((t) => t.status === s).map((t) => (
              <div key={t.id}>{t.title}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
