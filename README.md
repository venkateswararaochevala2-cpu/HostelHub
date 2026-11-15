# HostelHub – Room Allotment Management System

Backend REST API for **HostelHub**, a room allotment management system built to solve paper-based room allocation for hostel wardens.

Built with **Node.js**, **Express**, and **SQLite**.

> **Client Brief (Theme 10 of 30 · Room allotment):**  
> *"Rooms are allotted from a paper file. The warden cannot quickly tell which rooms are free in each block. Please build us a system that fixes this."*

---

## 🌐 Live Deployment

The API is fully deployed and accessible live on Render:
- **Live Base URL:** [`https://hostelhub-cjlu.onrender.com/`](https://hostelhub-cjlu.onrender.com/)
- **Live Health Check:** [`https://hostelhub-cjlu.onrender.com/health`](https://hostelhub-cjlu.onrender.com/health)
- **Live Rooms API:** [`https://hostelhub-cjlu.onrender.com/rooms`](https://hostelhub-cjlu.onrender.com/rooms)
- **Live Search Rooms by Block:** [`https://hostelhub-cjlu.onrender.com/rooms?block=Block%20A`](https://hostelhub-cjlu.onrender.com/rooms?block=Block%20A)
- **Live Residents API:** [`https://hostelhub-cjlu.onrender.com/residents`](https://hostelhub-cjlu.onrender.com/residents)
- **Live Allotments & SQL JOIN:** [`https://hostelhub-cjlu.onrender.com/allotments`](https://hostelhub-cjlu.onrender.com/allotments)

---

## 📁 Project Structure

```text
HostelHub/
│
├── app.js                              # Express application setup, routes mounting & error handlers
├── database.js                         # SQLite connection manager, schema DDL, seeds & query helpers
├── routes/
│   ├── rooms.js                        # Rooms CRUD + block query search + input validation
│   ├── residents.js                    # Residents REST API endpoints
│   └── allotments.js                   # Allotments REST API + JOIN endpoints + Twist status flow
├── test.js                             # Automated test suite (all 40 tests)
├── package.json                        # Project metadata, dependencies, and npm scripts
├── package-lock.json                   # Dependency lockfile
├── .gitignore                          # Ignores node_modules, *.db, *.sqlite, .env, .DS_Store
├── HostelHub-Postman-Collection.json   # Exported Postman Collection (v2.1.0)
├── screenshots/                        # Screenshots directory
└── README.md                           # Complete project guide and API documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.x or later)
- **npm** (v9.x or later)

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Run the Server
- **Production mode:**
  ```bash
  npm start
  ```
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

The server runs at: `http://localhost:3000`

### 4. Run Automated Tests
```bash
npm test
```
Executes all 40 automated tests covering:
- Server & Health Check endpoints
- Rooms CRUD & Block query parameter search
- Residents CRUD & Validation
- Allotments SQL JOIN endpoint
- Twist Rule Status Flow (Client Brief Tests 1, 2, and 3)

---

## 🗄️ Database Schema & Relational Design

The application utilizes SQLite with 3 interrelated tables. Foreign key enforcement is strictly enabled via `PRAGMA foreign_keys = ON;`.

### 1. `residents` Table
Stores hostel student/resident profile details:
```sql
CREATE TABLE IF NOT EXISTS residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL
);
```

### 2. `rooms` Table
Stores hostel room information with unique constraint per block:
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  block TEXT NOT NULL,
  UNIQUE(name, block)
);
```

### 3. `allotments` Table
Connects residents to rooms with an allotment status:
```sql
CREATE TABLE IF NOT EXISTS allotments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'done')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
);
```

---

## 📡 API Reference

### 1. Rooms API (`/rooms`)

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/rooms` | Get all rooms | 200, 500 |
| `GET` | `/rooms?block=Block%20A` | Search/filter rooms by block query parameter | 200, 400, 500 |
| `GET` | `/rooms/:id` | Get single room by ID | 200, 400, 404, 500 |
| `POST` | `/rooms` | Create a new room | 201, 400, 409, 500 |
| `PUT` | `/rooms/:id` | Update an existing room | 200, 400, 404, 409, 500 |
| `DELETE` | `/rooms/:id` | Delete a room by ID | 200, 400, 404, 409, 500 |

#### Example: Search Rooms by Block
- **Request:** `GET /rooms?block=Block A`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Room 101",
      "block": "Block A"
    },
    {
      "id": 2,
      "name": "Room 102",
      "block": "Block A"
    }
  ]
  ```

---

### 2. Residents API (`/residents`)

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/residents` | Get all residents | 200, 500 |
| `GET` | `/residents/:id` | Get single resident by ID | 200, 400, 404, 500 |
| `POST` | `/residents` | Create new resident | 201, 400, 409, 500 |
| `PUT` | `/residents/:id` | Update an existing resident | 200, 400, 404, 409, 500 |
| `DELETE` | `/residents/:id` | Delete resident by ID | 200, 400, 404, 409, 500 |

---

### 3. Allotments & SQL JOIN API (`/allotments`)

The brief requires:
> *"One join endpoint: allotments with the resident name and the room name."*

#### SQL JOIN Query:
```sql
SELECT 
  allotments.id,
  allotments.resident_id,
  residents.name AS resident_name,
  residents.roll_number,
  residents.department,
  allotments.room_id,
  rooms.name AS room_name,
  rooms.block AS room_block,
  allotments.status,
  allotments.created_at
FROM allotments
JOIN residents ON allotments.resident_id = residents.id
JOIN rooms ON allotments.room_id = rooms.id;
```

#### Endpoints:
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/allotments` | Get all allotments with SQL JOIN details | 200, 500 |
| `GET` | `/allotments/details` | Explicit JOIN details endpoint | 200, 400, 500 |
| `GET` | `/allotments/details/:id`| Get single allotment with JOIN details | 200, 400, 404, 500 |
| `GET` | `/allotments/:id` | Get single allotment by ID | 200, 400, 404, 500 |
| `POST` | `/allotments` | Add allotment (starts as `pending`) | 201, 400, 404, 500 |
| `PATCH` | `/allotments/:id/status`| Move status forward (Twist Rule) | 200, 400, 404, 500 |
| `DELETE` | `/allotments/:id` | Delete an allotment | 200, 400, 404, 500 |

---

## 🌪️ Client Brief Twist Rule: Status Flow

> **Card Requirement:**  
> *"Every allotment has a status: pending, approved or done. PATCH /allotments/:id/status may only move it one step forward. Any other move gets 400 and the message 'Invalid status change'."*

### Status Transition State Machine
```text
           ┌───────────────────────┐
           │        pending        │
           └───────────┬───────────┘
                       │ PATCH (status: 'approved') -> 200 OK
                       ▼
           ┌───────────────────────┐
           │       approved        │
           └───────────┬───────────┘
                       │ PATCH (status: 'done') -> 200 OK
                       ▼
           ┌───────────────────────┐
           │         done          │
           └───────────────────────┘
```

### Verification Against Client Brief Tests:
1. **Test 1**: Add an allotment → starts as `pending`, returns `201 Created`
   - Request: `POST /allotments` with `{ "resident_id": 1, "room_id": 2 }`
   - Response: `201 Created`, `status: "pending"`
2. **Test 2**: `pending` → `approved` → `200 OK`
   - Request: `PATCH /allotments/1/status` with `{ "status": "approved" }`
   - Response: `200 OK`, `status: "approved"`
3. **Test 3**: `approved` → `pending` → `400 Bad Request`
   - Request: `PATCH /allotments/1/status` with `{ "status": "pending" }`
   - Response (`400 Bad Request`):
     ```json
     {
       "error": "Invalid status change",
       "current_status": "approved",
       "requested_status": "pending"
     }
     ```
4. **Edge Cases**:
   - `approved` → `done` returns `200 OK`
   - `pending` → `done` (skipping step) returns `400 Bad Request` with `"Invalid status change"`
   - `done` → anything returns `400 Bad Request` with `"Invalid status change"`

---

## 📮 Postman Collection Setup

1. Open Postman.
2. Click **Import** and select `HostelHub-Postman-Collection.json` directly from the project root.
3. The collection is organized into 6 clean folders:
   - `01 - Health & Root`
   - `02 - Rooms CRUD & Search`
   - `03 - Residents CRUD`
   - `04 - Allotments & SQL JOIN`
   - `05 - Twist Tests (Status Flow)` (Contains Tests 1, 2, and 3)
   - `06 - Validation & Errors`

---

## 📸 Screenshots & Live API Execution Proofs

All actions and endpoints have been executed against the live Render deployment (`https://hostelhub-cjlu.onrender.com/`). The execution proofs below are organized into **Browser Path Navigation** and **Postman Mutation & Twist Rule Actions**:

---

### Part A: Live Browser Path Navigation (`https://hostelhub-cjlu.onrender.com`)

#### 1. Root Welcome & API Directory (`GET /`)
![01 - Browser Root Welcome](screenshots/01-browser-root.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/`](https://hostelhub-cjlu.onrender.com/)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Root API discovery returning server status, project theme metadata, and links to all available endpoints.

---

#### 2. Health Check (`GET /health`)
![02 - Browser Health Check](screenshots/02-browser-health.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/health`](https://hostelhub-cjlu.onrender.com/health)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Uptime monitoring endpoint returning `{ "status": "OK", "message": "HostelHub server is running and healthy" }`.

---

#### 3. All Rooms List (`GET /rooms`)
![03 - Browser All Rooms](screenshots/03-browser-rooms.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/rooms`](https://hostelhub-cjlu.onrender.com/rooms)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Fetches all rooms across all hostel blocks ordered by ID.

---

#### 4. Search Rooms by Query Parameter (`GET /rooms?block=Block A`)
![04 - Browser Rooms Search by Block](screenshots/04-browser-rooms-search.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/rooms?block=Block%20A`](https://hostelhub-cjlu.onrender.com/rooms?block=Block%20A)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Client Brief search requirement — filters rooms case-insensitively using SQLite `LIKE` parameterization.

---

#### 5. Get Single Room by ID (`GET /rooms/1`)
![05 - Browser Single Room by ID](screenshots/05-browser-room-by-id.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/rooms/1`](https://hostelhub-cjlu.onrender.com/rooms/1)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Retrieves details of a specific room record (`Room 101` in `Block A`).

---

#### 6. All Residents List (`GET /residents`)
![06 - Browser All Residents](screenshots/06-browser-residents.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/residents`](https://hostelhub-cjlu.onrender.com/residents)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Returns all registered student residents with roll number and department details.

---

#### 7. Get Single Resident by ID (`GET /residents/1`)
![07 - Browser Single Resident by ID](screenshots/07-browser-resident-by-id.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/residents/1`](https://hostelhub-cjlu.onrender.com/residents/1)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Fetches resident profile by primary key (`Rahul Sharma`, `21CS001`).

---

#### 8. SQL JOIN: Allotments with Resident & Room Details (`GET /allotments`)
![08 - Browser Allotments SQL JOIN](screenshots/08-browser-allotments-join.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/allotments`](https://hostelhub-cjlu.onrender.com/allotments)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Core Client Brief requirement — executes a 3-table SQL JOIN projecting `resident_name`, `roll_number`, `room_name`, `room_block`, and `status`.

---

#### 9. Single Allotment Details (`GET /allotments/1`)
![09 - Browser Single Allotment Details](screenshots/09-browser-allotment-by-id.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/allotments/1`](https://hostelhub-cjlu.onrender.com/allotments/1)
- **Method:** `GET` | **Status Code:** `200 OK`
- **Description:** Returns full relational details for a single room allocation by ID.

---

#### 10. Non-Existent Room Error Handling (`GET /rooms/999`)
![10 - Browser Room Not Found 404](screenshots/10-browser-rooms-404.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/rooms/999`](https://hostelhub-cjlu.onrender.com/rooms/999)
- **Method:** `GET` | **Status Code:** `404 Not Found`
- **Description:** Gracefully handles non-existent IDs with `{ "error": "Room with ID 999 not found" }`.

---

#### 11. Catch-All Route 404 (`GET /unknown-route`)
![11 - Browser Route Not Found 404](screenshots/11-browser-route-404.png)
- **Live Path:** [`https://hostelhub-cjlu.onrender.com/unknown-route`](https://hostelhub-cjlu.onrender.com/unknown-route)
- **Method:** `GET` | **Status Code:** `404 Not Found`
- **Description:** Express global catch-all returning JSON error response for unmapped paths.

---

### Part B: Postman API Execution Proofs

The complete Postman test suite was executed against the API with each test assertion verified:

#### 1. API Root Discovery (`GET /`)
![01 - Postman Root](screenshots/01-home-api.png)
- **Endpoint:** `GET /`
- **Status Code:** `200 OK`
- **Description:** Verifies base server reachability and API route map output.

---

#### 2. Create Room with Validation (`POST /rooms`)
![02 - Postman Create Room](screenshots/02-create-room.png)
- **Endpoint:** `POST /rooms`
- **Payload:** `{"name": "Room 501", "block": "Block E"}`
- **Status Code:** `201 Created`
- **Description:** Inserts a new room record with required fields and verifies successful creation response.

---

#### 3. Twist Test 1: Add Allotment Starting as Pending (`POST /allotments`)
![03 - Postman Create Allotment](screenshots/03-create-allotment.png)
- **Endpoint:** `POST /allotments`
- **Payload:** `{"resident_id": 1, "room_id": 2}`
- **Status Code:** `201 Created`
- **Description:** **Client Brief Test 1** — Verifies that newly created allotments automatically initialize with status `pending`.

---

#### 4. Relational SQL JOIN Allotments (`GET /allotments`)
![04 - Postman Get Allotments JOIN](screenshots/04-get-allotments.png)
- **Endpoint:** `GET /allotments`
- **Status Code:** `200 OK`
- **Description:** Verifies 3-table SQL JOIN querying resident name, roll number, room name, and block along with allotment status.

---

#### 5. Twist Test 2: Status Forward `pending` → `approved` (`PATCH /allotments/:id/status`)
![05 - Postman Approve Allotment](screenshots/05-approve-allotment.png)
- **Endpoint:** `PATCH /allotments/1/status`
- **Payload:** `{"status": "approved"}`
- **Status Code:** `200 OK`
- **Description:** **Client Brief Test 2** — Verifies advancing status by one step forward from `pending` to `approved`.

---

#### 6. Duplicate Room Conflict Handling (`POST /rooms`)
![06 - Postman Room Conflict](screenshots/06-create-room.png)
- **Endpoint:** `POST /rooms`
- **Status Code:** `409 Conflict` / `201 Created`
- **Description:** Validates uniqueness enforcement for room name and block combinations.

---

#### 7. Twist Test 3: Disallowed Reversal `approved` → `pending` (`PATCH /allotments/:id/status`)
![07 - Postman Invalid Status Change](screenshots/07-invalid-status-transition.png)
- **Endpoint:** `PATCH /allotments/1/status`
- **Payload:** `{"status": "pending"}`
- **Status Code:** `400 Bad Request`
- **Description:** **Client Brief Test 3** — State machine rejects backward transitions with exact error `"Invalid status change"`.

---

#### 8. Get Allotment by ID (`GET /allotments/:id`)
![08 - Postman Get Allotment by ID](screenshots/08-get-allotment-by-id.png)
- **Endpoint:** `GET /allotments/1`
- **Status Code:** `200 OK`
- **Description:** Verifies single relational allotment record retrieval.

---

#### 9. Allotment Not Found (`GET /allotments/999`)
![09 - Postman Allotment Not Found](screenshots/09-allotment-not-found.png)
- **Endpoint:** `GET /allotments/999`
- **Status Code:** `404 Not Found`
- **Description:** Validates proper 404 response when querying non-existent allotment records.

---

#### 10. Allotment Validation Error (`POST /allotments`)
![10 - Postman Validation Error](screenshots/10-allotment-validation-error.png)
- **Endpoint:** `POST /allotments`
- **Payload:** Missing required foreign keys
- **Status Code:** `400 Bad Request`
- **Description:** Validates payload rejection with descriptive error feedback when mandatory fields are omitted.

---

## 📜 Assessment Hand-in Checklist

- [x] Express server with routes for `residents`, `rooms`, and `allotments`
- [x] SQLite database with 3 related tables and foreign key constraints
- [x] Rooms CRUD with correct status codes (`200`, `201`, `400`, `404`, `409`)
- [x] SQL JOIN endpoint returning allotment details with resident name and room name
- [x] Validation on add and update with clear error messages
- [x] Search by query parameter: rooms by block (`GET /rooms?block=Block%20A`)
- [x] Twist Rule: Status flow (`pending` → `approved` → `done`), 400 on other moves with `"Invalid status change"`
- [x] Test 1 passed (Add allotment → starts as `pending`, 201)
- [x] Test 2 passed (`pending` → `approved`, 200)
- [x] Test 3 passed (`approved` → `pending`, 400 `"Invalid status change"`)
- [x] Complete Postman collection JSON exported at root
- [x] Clean single test suite (`npm test`) with 100% pass rate
- [x] Live deployment active on Render (`https://hostelhub-cjlu.onrender.com/`)
- [x] All live browser & Postman action execution screenshots embedded in README


