import { useState, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function Register() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", { email, password });
      //Needed to get the Token
      const loginRes = await api.post("/auth/login", { email, password });
      login(loginRes.data.token);
      
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur de connexion");
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">Inscription</h1>
        <p className="auth-subtitle">Entre tes identifiants pour continuer.</p>

        {error && <div className="alert">{error}</div>}

        <label className="label">Email</label>
        <input className="input" placeholder="email@exemple.com" onChange={(e) => setEmail(e.target.value)} />

        <label className="label">Mot de passe</label>
        <input className="input" type="password" placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />

        <button className="btn btn-primary" type="submit">S'inscrire</button>

        <p className="auth-footer">
          Tu a un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
