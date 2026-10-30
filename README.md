# Workbench — Workshop Inventory

A small full-stack inventory system for keeping track of workshop parts. The two frontends are independent clients of **one shared Starlette + MySQL API**.

| Component | Stack | Purpose | Default HTTP port |
|---|---|---|---|
| Backend | Python, Starlette, aiomysql | API, validation, database, audit history | `8888` |
| Operator console | AngularJS 1.8, JavaScript, Vite | Everyday inventory management | `8080` |
| Insights dashboard | React 19, TypeScript, Vite | Summary metrics, alerts, catalog and activity | `8080` |
| Database | MySQL 8+ | Durable items and movement records | `3306` |

**This source project intentionally includes no Docker configuration files.** Container builds, service definitions, ignore rules, and deployment configuration are left entirely to the student.

## Functional requirements implemented

- Create, view, edit, search, filter, and delete inventory items.
- Adjust stock in and out without allowing negative quantities.
- Log each change in a movement history, including initial stock.
- Keep movement history after an item is deleted.
- Summarize total unique SKUs, units, stock alerts, and categories.
- Protect against duplicate SKU entries and invalid API payloads.
- Load database credentials from environment variables.
- Set the backend address independently for **each frontend**, **at runtime**.

## Repository layout

```text
workshop-inventory/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── tests/
│   ├── run.py
   ├── seed.py
│   ├── .env.example
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend-angularjs/
│   ├── src/
│   │   ├── main.js
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   ├── server.mjs
│   ├── .env.example
│   └── package.json
└── frontend-react/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   ├── types.ts
    │   ├── main.tsx
    │   └── styles.css
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── server.mjs
    ├── .env.example
    └── package.json
```

## Environment variables

### Backend

All five are **required** by the API process; there are no hardcoded database credentials:

| Variable | Example | Description |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | MySQL hostname or service DNS name |
| `DB_PORT` | `3306` | MySQL TCP port |
| `DB_NAME` | `workshop_inventory` | Existing MySQL database/schema |
| `DB_USER` | `workshop_user` | MySQL user with permission to create and modify tables |
| `DB_PASS` | `your_password` | MySQL password |

Launch the backend with `python run.py` to bind to `0.0.0.0:8888`. The `DB_PORT` variable is for the **MySQL** port, not the HTTP API port.

The backend creates the `items` and `movements` tables on startup **inside an existing database**. Create the database and grant the user suitable permissions before starting the API. Example administrative SQL (customize the user and password):

```sql
CREATE DATABASE workshop_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'workshop_user'@'%' IDENTIFIED BY 'change_me';
GRANT ALL PRIVILEGES ON workshop_inventory.* TO 'workshop_user'@'%';
```

The MySQL user and database above are only examples; set the actual credentials through the environment.

### Each frontend

| Variable | Example | Description |
|---|---|---|
| `BACKEND_HOST` | `127.0.0.1` | Backend hostname **as seen by the frontend Node server** |
| `BACKEND_PORT` | `8888` | Backend HTTP port as seen by the frontend Node server |
| `FRONTEND_PORT` | `8080` | Port exposed by that frontend server, in development and production |

Both frontends send browser requests to **relative paths** such as `/api/items`. Their **own Node HTTP process** transparently forwards `/api/*` to `http://BACKEND_HOST:BACKEND_PORT/api/*` at runtime. The Vite development servers use the same variables for their dev proxies. This design:

1. Does **not** compile the backend URL into the frontend JavaScript.
2. Does **not** require the user's browser to resolve backend service names on an internal network.
3. Can change the backend address without rebuilding frontend static assets.
4. Avoids cross-origin browser requests in the default setup.

**Port mapping:** Both frontend processes listen on port `8080` and the API process listens on `8888`. In separate containers, the frontends can share the same internal listening port because they have independent network namespaces; publish them on **different host ports** (for example, `8081` and `8082`) when running them together. If you run both frontends directly on one machine instead of in separate containers, use a temporary override such as `FRONTEND_PORT=8081 npm run dev` for one of them to avoid a bind conflict.

**Important:** With separate service network namespaces, `BACKEND_HOST=127.0.0.1` points to the *frontend* service itself, not to the API service. Set `BACKEND_HOST` to an address/DNS name the frontend process can actually reach. Choose the Node.js runtime server (`npm start`) for serving built frontend assets so that the runtime proxy is available.

## Run locally without containers

Requirements: Python 3.11+, Node.js 20.19+ (or compatible 22+), npm, MySQL 8+.

1. Set up a MySQL database using the SQL above.
2. Start the backend:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env for your MySQL credentials.
   python run.py
   ```

3. Start the AngularJS operator console in a second terminal:

   ```bash
   cd frontend-angularjs
   npm install
   cp .env.example .env
   npm run dev
   ```

   Open http://localhost:8080

4. Start the React/TypeScript dashboard in a third terminal (after stopping AngularJS, or temporarily overriding its host port):

   ```bash
   cd frontend-react
   npm install
   cp .env.example .env
   npm run dev
   ```

   Open http://localhost:8080 (if the AngularJS frontend is not also using this host port)

### Optional: load demo parts

With the backend environment configured, run `python seed.py` from `backend/` to add 12 sample parts and initial movement records. This is safe to rerun because it only inserts missing SKUs. It requires a reachable MySQL database.

`cp` and `source` commands above are written for Linux/macOS shells. On other operating systems, use equivalent commands.

### Production-style frontend build and runtime (without containers)

Run the following commands in **each** frontend directory:

```bash
npm install
npm run build
npm start
```

Each `npm run build` writes static files to `dist/`. `npm start` runs that frontend's standalone Node HTTP server, which serves the built files and proxies `/api` based on the **current** environment variables. You can change `BACKEND_HOST` and `BACKEND_PORT`, restart the server, and reuse the same build.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Database-aware health check |
| GET | `/api/items` | List items; optional `?search=...&category=...` |
| GET | `/api/items/{id}` | Get one item |
| POST | `/api/items` | Create item; initial stock generates a movement |
| PUT | `/api/items/{id}` | Update name, SKU, category, unit, reorder threshold |
| DELETE | `/api/items/{id}` | Remove item; preserve movement history |
| GET | `/api/movements` | Retrieve latest 40 stock movements |
| POST | `/api/movements` | Add or remove stock with a signed `delta` |
| GET | `/api/stats` | Inventory KPIs and category distribution |

### Sample requests

Create an item:

```bash
curl -X POST http://localhost:8888/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"M8 Hex Bolts","sku":"BLT-M8","category":"Fasteners","unit":"pcs","quantity":120,"reorder_level":25}'
```

Remove 10 units (not permitted if the balance would become negative):

```bash
curl -X POST http://localhost:8888/api/movements \
  -H 'Content-Type: application/json' \
  -d '{"item_id":1,"delta":-10,"note":"Assembly job #82"}'
```

Responses are JSON. Successful list requests contain an `items` or `movements` array. Failed requests use `{"error":"..."}` with appropriate HTTP status codes (400, 404, 409, 422, 500, or 503).

## Tests and verification

Backend schema validation tests, without connecting to MySQL:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Build checks for both independently deployable frontends:

```bash
cd frontend-angularjs && npm install && npm run build
cd ../frontend-react && npm install && npm run build
```

A complete end-to-end test needs a running MySQL instance with a database and configured backend environment variables.

## Notes

- AngularJS 1.x is an end-of-life framework. It is used here intentionally because this assignment requests AngularJS with JavaScript.
- This is a demonstration application, not a production-ready identity or authorization system. Run it only in a trusted environment unless you add authentication, HTTPS, and appropriate access controls.
- No secret files, generated distribution folders, or dependency directories should be treated as application source. Use the supplied `.env.example` files as templates, never as real credentials.
