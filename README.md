![CI](https://github.com/PhilippeSlater/task-manager/actions/workflows/ci.yml/badge.svg)
# 🚀 Task Manager – Collaborative Kanban App

Application web moderne de gestion de tâches collaborative (type Trello simplifié) avec authentification sécurisée, mises à jour en temps réel et déploiement cloud automatisé.


---

## 🧱 Stack Technique

### Frontend
- React + Vite
- Axios
- Socket.io Client
- React Router
- DnD Kit (drag & drop)

### Backend
- Node.js
- Express
- PostgreSQL (Supabase)
- JWT Authentication
- Bcrypt (hashing)
- Socket.io

### DevOps
- Docker & Docker Compose
- GitHub Actions (CI)
- Render (Deployment)
- Supabase (Database)

---

## ✨ Fonctionnalités

- Création de compte / Connexion sécurisée (JWT)
- Tableaux Kanban (À faire / En cours / Terminé)
- Drag & Drop des tâches
- Collaboration en temps réel via WebSocket
- Responsive (mobile & desktop)
- Déploiement automatique via CI/CD

---

# Local setup

## Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```

## Frontend
```bash
cd client
npm install
npm run dev
```

## Docker (full stack)
environment : VITE_API_URL = http://localhost:5000
```bash
docker compose up --build
```
Frontend: http://localhost:3000
Backend: http://localhost:5000

## Environment variables

server/.env
- DATABASE_URL: URL Postgres (Supabase)
- JWT_SECRET: secret JWT
- FRONTEND_URL: URL du frontend (pour CORS)

---

## CI (GitHub Actions)

Le pipeline CI build le frontend et vérifie l’installation des dépendances server/client à chaque push / PR.

--

## Deploy (Render)
Backend: Web Service (root: server)
Frontend: Static Site (root: client)
SPA rewrite: /* -> /index.html
VITE_API_URL du frontend pointe vers l’URL backend Render

---

## Testing (server)
```bash
cd server
docker compose -f docker-compose.test.yml up -d
npm test
```
---
---

## What I learned

- JWT authentication and protected REST APIs
- Real-time collaboration with Socket.io rooms
- Docker multi-service setup
- CI pipelines with GitHub Actions
- Cloud deployment on Render
- PostgreSQL relational modeling
- Optimistic UI updates

## TODO
[ ] Allow member to accept or decline an invite
[ ] Allow role option : Owner, admin (create column, task, ...) and member (add info into a task)
[ ] Allow member assign to a task
[ ] Add final BD scripts
