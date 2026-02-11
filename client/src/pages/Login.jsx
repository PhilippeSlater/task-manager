import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      login(res.data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur de connexion");
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">Connexion</h1>
        <p className="auth-subtitle">Entre tes identifiants pour continuer.</p>

        {error && <div className="alert">{error}</div>}

        <label className="label">Email</label>
        <input className="input" placeholder="email@exemple.com" onChange={(e) => setEmail(e.target.value)} />

        <label className="label">Mot de passe</label>
        <input className="input" type="password" placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />

        <button className="btn btn-primary" type="submit">Se connecter</button>

        <p className="auth-footer">
          Pas de compte ? <Link to="/register">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
