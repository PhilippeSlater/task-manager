import { Link } from "react-router-dom";

export default function Welcome() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Task Manager</h1>
        <p className="auth-subtitle">
          Organise tes tâches en mode Kanban, en temps réel.
        </p>

        <div className="auth-actions">
          <Link className="btn btn-primary" to="/login">Se connecter</Link>
          <Link className="btn btn-secondary" to="/register">Créer un compte</Link>
        </div>

        <p className="auth-footer">
          Projet portfolio • React / Node / PostgreSQL
        </p>
      </div>
    </div>
  );
}
