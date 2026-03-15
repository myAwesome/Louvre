# foto-ill

Photo gallery manager for sorting, tagging, and organizing images.

**Stack:** React 19 (frontend) · Go / Gin (API) · MySQL (storage)

---

## Prerequisites

- Node.js ≥ 18 + npm
- Go ≥ 1.23
- MySQL 8+

---

## Quick start

```bash
./dev.sh
```

The script copies `.env.example` files, installs dependencies, and starts both servers. Edit the generated `.env` files before running if you need non-default values.

---

## Manual setup

### 1. Environment

```bash
cp .env.example .env                    # frontend
cp server/.env.example server/.env      # backend
```

Edit `server/.env` — at minimum set:

| Variable | Description |
|---|---|
| `DB_DSN` | MySQL connection string |
| `ASSETS_DIR` | Absolute path to `public/assets/origin` |
| `API_KEY` | Request auth key (leave empty to disable) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins (default: `http://localhost:3000`) |

`REACT_APP_API_URL` in `.env` points to the Go server (default `http://localhost:8080`).

### 2. Database

Create the database and a user:

```sql
CREATE DATABASE `foto-ill` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'foto'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON `foto-ill`.* TO 'foto'@'localhost';
```

The schema is auto-migrated on first run.

### 3. Frontend

```bash
npm install
npm start       # dev server on :3000
```

### 4. Backend

```bash
cd server
go run main.go  # API on :8080
```

---

## Project structure

```
foto-ill/
├── src/                  # React app
│   └── components/
│       ├── Folders.js    # Gallery browser with tagging
│       ├── Bin.js        # Trash bin
│       └── Sandbox.js    # Collections (GP / Liked / Nomad)
├── server/
│   ├── main.go           # Gin API server
│   └── .env.example
├── public/
│   └── assets/           # Photo files (not tracked in git)
├── .env.example
└── dev.sh                # Bootstrap script
```

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/scan?path=` | List files/folders at path |
| `GET` | `/actions?path=` | Get tags for items in path |
| `POST` | `/actions?name=&action=` | Set tag (`like`, `del`, `gp`, `nomad`, `up`, `down`, `rank`) |
| `GET` | `/trash-bin` | List deleted items |
| `GET` | `/empty` | Permanently delete trash |
| `GET` | `/all-gp` | All GP-tagged items |
| `GET` | `/all-liked` | All liked items |
| `GET` | `/all-nomad` | All nomad items |
| `GET` | `/open-item?name=` | Open file in default app |
| `GET` | `/photoshop?name=` | Open file in Photoshop 2025 |
| `GET` | `/move-gp` | Move GP files to GP folder |

Requests with `API_KEY` set require the `X-API-Key` header.
