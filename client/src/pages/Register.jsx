import { useState, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function Register() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

    const submit = async (e) => {
    e.preventDefault();

    await api.post("/auth/register", { email, password });
    //Needed to get the Token
    const loginRes = await api.post("/auth/login", { email, password });

    login(loginRes.data.token);
    window.location.href = "/";
    };

  return (
    <form onSubmit={submit}>
      <input placeholder="email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="password" onChange={(e) => setPassword(e.target.value)} />
      <button>Register</button>
    </form>
  );
}
