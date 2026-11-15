const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = path.join(__dirname, 'hostelhub.db');

let dbInstance = null;

/**
 * Returns the shared SQLite database connection.
 * Used by all route modules (rooms, residents, allotments).
 *
 * Query interface supported:
 * - db.all(sql, [params]) -> returns array of rows
 * - db.get(sql, [params]) -> returns single row or undefined
 * - db.run(sql, [params]) -> returns { lastID, changes }
 */
const getDatabase = async () => {
  try {
    if (!dbInstance) {
      dbInstance = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
      });
      // Enable SQLite foreign key constraint enforcement
      await dbInstance.run('PRAGMA foreign_keys = ON;');
    }
    return dbInstance;
  } catch (error) {
    console.error('[Database] Failed to open SQLite connection:', error.message);
    throw error;
  }
};

/**
 * Closes the active database connection if open.
 * Useful for clean test teardown and graceful server shutdown.
 */
const closeDatabase = async () => {
  try {
    if (dbInstance) {
      await dbInstance.close();
      dbInstance = null;
    }
  } catch (error) {
    console.error('[Database] Error closing connection:', error.message);
    throw error;
  }
};

/**
 * ============================================================================
 * SQL TABLE CREATION STATEMENTS (Member 2 Deliverable)
 * ============================================================================
 */
const CREATE_RESIDENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    roll_number TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL
  );
`;

const CREATE_ROOMS_TABLE = `
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    block TEXT NOT NULL,
    UNIQUE(name, block)
  );
`;

const CREATE_ALLOTMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS allotments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'done')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE RESTRICT,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
  );
`;

/**
 * SQL JOIN Query template for allotments endpoint:
 * Retrieves complete allotment information with resident name, roll number,
 * department, room name, and room block.
 */
const ALLOTMENTS_JOIN_QUERY = `
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
  JOIN rooms ON allotments.room_id = rooms.id
`;

/**
 * Seeds initial sample records only if the respective tables are empty.
 * Dynamically references existing resident and room IDs to guarantee foreign key integrity.
 * Avoids duplicate records on subsequent server restarts.
 */
const seedSampleData = async (db) => {
  // 1. Seed residents if empty
  const residentCount = await db.get('SELECT COUNT(*) AS count FROM residents');
  if (residentCount.count === 0) {
    const sampleResidents = [
      { name: 'Rahul Sharma', roll_number: '21CS001', department: 'Computer Science' },
      { name: 'Priya Patel', roll_number: '21EC015', department: 'Electronics' },
      { name: 'Amit Verma', roll_number: '21ME032', department: 'Mechanical' },
      { name: 'Sneha Reddy', roll_number: '21IT045', department: 'Information Tech' },
    ];
    for (const res of sampleResidents) {
      await db.run(
        'INSERT INTO residents (name, roll_number, department) VALUES (?, ?, ?)',
        [res.name, res.roll_number, res.department]
      );
    }
  }

  // 2. Seed rooms if empty
  const roomCount = await db.get('SELECT COUNT(*) AS count FROM rooms');
  if (roomCount.count === 0) {
    const sampleRooms = [
      { name: 'Room 101', block: 'Block A' },
      { name: 'Room 102', block: 'Block A' },
      { name: 'Room 201', block: 'Block B' },
      { name: 'Room 202', block: 'Block B' },
      { name: 'Room 301', block: 'Block C' },
    ];
    for (const room of sampleRooms) {
      await db.run(
        'INSERT INTO rooms (name, block) VALUES (?, ?)',
        [room.name, room.block]
      );
    }
  }

  // 3. Seed allotments if empty AND valid parent records exist
  const allotmentCount = await db.get('SELECT COUNT(*) AS count FROM allotments');
  if (allotmentCount.count === 0) {
    const residents = await db.all('SELECT id FROM residents ORDER BY id ASC');
    const rooms = await db.all('SELECT id FROM rooms ORDER BY id ASC');

    if (residents.length > 0 && rooms.length > 0) {
      const r1 = residents[0].id;
      const r2 = residents[1] ? residents[1].id : r1;
      const r3 = residents[2] ? residents[2].id : r1;
      const rm1 = rooms[0].id;
      const rm2 = rooms[1] ? rooms[1].id : rm1;
      const rm3 = rooms[2] ? rooms[2].id : rm1;

      const sampleAllotments = [
        { resident_id: r1, room_id: rm1, status: 'pending' },
        { resident_id: r2, room_id: rm2, status: 'approved' },
        { resident_id: r3, room_id: rm3, status: 'done' },
      ];

      for (const allotment of sampleAllotments) {
        await db.run(
          'INSERT INTO allotments (resident_id, room_id, status) VALUES (?, ?, ?)',
          [allotment.resident_id, allotment.room_id, allotment.status]
        );
      }
    }
  }
};

/**
 * ============================================================================
 * DATABASE INITIALIZATION & SCHEMA COORDINATION
 * ============================================================================
 * Automatically called when Express starts (app.js -> startServer).
 * Creates residents, rooms, and allotments tables if not present,
 * enables foreign keys, and seeds minimal sample data idempotently.
 */
const initializeDatabase = async () => {
  try {
    const db = await getDatabase();

    // Create tables in correct dependency order
    await db.exec(CREATE_RESIDENTS_TABLE);
    await db.exec(CREATE_ROOMS_TABLE);
    await db.exec(CREATE_ALLOTMENTS_TABLE);

    // Seed sample data without duplicating
    await seedSampleData(db);

    console.log(`[Database] SQLite connected & schema initialized at: ${DB_PATH}`);
    return db;
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error.message);
    throw error;
  }
};

/**
 * ============================================================================
 * REUSABLE OPERATIONS: RESIDENTS
 * ============================================================================
 */
const getAllResidents = async () => {
  const db = await getDatabase();
  return db.all('SELECT * FROM residents ORDER BY id ASC');
};

const getResidentById = async (id) => {
  const db = await getDatabase();
  return db.get('SELECT * FROM residents WHERE id = ?', [id]);
};

const insertResident = async (residentData) => {
  const db = await getDatabase();
  const { name, roll_number, department } = residentData || {};

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Resident name is required and must be a non-empty string.');
  }
  if (typeof roll_number !== 'string' || !roll_number.trim()) {
    throw new Error('Roll number is required and must be a non-empty string.');
  }
  if (typeof department !== 'string' || !department.trim()) {
    throw new Error('Department is required and must be a non-empty string.');
  }

  const trimmedName = name.trim();
  const trimmedRoll = roll_number.trim();
  const trimmedDept = department.trim();

  const result = await db.run(
    'INSERT INTO residents (name, roll_number, department) VALUES (?, ?, ?)',
    [trimmedName, trimmedRoll, trimmedDept]
  );

  return {
    id: result.lastID,
    name: trimmedName,
    roll_number: trimmedRoll,
    department: trimmedDept,
  };
};

const updateResident = async (id, residentData) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid resident ID. ID must be a positive integer.');
  }

  const { name, roll_number, department } = residentData || {};
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Resident name is required and must be a non-empty string.');
  }
  if (typeof roll_number !== 'string' || !roll_number.trim()) {
    throw new Error('Roll number is required and must be a non-empty string.');
  }
  if (typeof department !== 'string' || !department.trim()) {
    throw new Error('Department is required and must be a non-empty string.');
  }

  const db = await getDatabase();
  const existing = await db.get('SELECT * FROM residents WHERE id = ?', [parsedId]);
  if (!existing) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedRoll = roll_number.trim();
  const trimmedDept = department.trim();

  await db.run(
    'UPDATE residents SET name = ?, roll_number = ?, department = ? WHERE id = ?',
    [trimmedName, trimmedRoll, trimmedDept, parsedId]
  );

  return {
    id: parsedId,
    name: trimmedName,
    roll_number: trimmedRoll,
    department: trimmedDept,
  };
};

const deleteResident = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid resident ID. ID must be a positive integer.');
  }

  const db = await getDatabase();
  const existing = await db.get('SELECT * FROM residents WHERE id = ?', [parsedId]);
  if (!existing) {
    return false;
  }

  await db.run('DELETE FROM residents WHERE id = ?', [parsedId]);
  return true;
};

/**
 * ============================================================================
 * REUSABLE OPERATIONS: ROOMS
 * ============================================================================
 */
const getAllRooms = async () => {
  const db = await getDatabase();
  return db.all('SELECT * FROM rooms ORDER BY id ASC');
};

const getRoomById = async (id) => {
  const db = await getDatabase();
  return db.get('SELECT * FROM rooms WHERE id = ?', [id]);
};

const getRoomsByBlock = async (block) => {
  if (typeof block !== 'string' || !block.trim()) {
    throw new Error('Room block is required and must be a non-empty string.');
  }
  const db = await getDatabase();
  return db.all('SELECT * FROM rooms WHERE LOWER(block) = LOWER(?) ORDER BY id ASC', [block.trim()]);
};

const insertRoom = async (roomData) => {
  const db = await getDatabase();
  const { id, name, block } = roomData || {};

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Room name is required and must be a non-empty string.');
  }
  if (typeof block !== 'string' || !block.trim()) {
    throw new Error('Room block is required and must be a non-empty string.');
  }

  const trimmedName = name.trim();
  const trimmedBlock = block.trim();

  let newId;
  if (id !== undefined && id !== null) {
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new Error('Invalid room ID. If provided, "id" must be a positive integer.');
    }
    await db.run(
      'INSERT INTO rooms (id, name, block) VALUES (?, ?, ?)',
      [parsedId, trimmedName, trimmedBlock]
    );
    newId = parsedId;
  } else {
    const result = await db.run(
      'INSERT INTO rooms (name, block) VALUES (?, ?)',
      [trimmedName, trimmedBlock]
    );
    newId = result.lastID;
  }

  return {
    id: newId,
    name: trimmedName,
    block: trimmedBlock,
  };
};

const updateRoom = async (id, roomData) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid room ID. ID must be a positive integer.');
  }

  const { name, block } = roomData || {};
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Room name is required and must be a non-empty string.');
  }
  if (typeof block !== 'string' || !block.trim()) {
    throw new Error('Room block is required and must be a non-empty string.');
  }

  const db = await getDatabase();
  const existing = await db.get('SELECT * FROM rooms WHERE id = ?', [parsedId]);
  if (!existing) {
    return null;
  }

  const trimmedName = name.trim();
  const trimmedBlock = block.trim();

  await db.run(
    'UPDATE rooms SET name = ?, block = ? WHERE id = ?',
    [trimmedName, trimmedBlock, parsedId]
  );

  return {
    id: parsedId,
    name: trimmedName,
    block: trimmedBlock,
  };
};

const deleteRoom = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid room ID. ID must be a positive integer.');
  }

  const db = await getDatabase();
  const existing = await db.get('SELECT * FROM rooms WHERE id = ?', [parsedId]);
  if (!existing) {
    return false;
  }

  await db.run('DELETE FROM rooms WHERE id = ?', [parsedId]);
  return true;
};

/**
 * ============================================================================
 * REUSABLE OPERATIONS: ALLOTMENTS
 * ============================================================================
 */
const getAllAllotments = async () => {
  const db = await getDatabase();
  return db.all('SELECT * FROM allotments ORDER BY id ASC');
};

const getAllotmentById = async (id) => {
  const db = await getDatabase();
  return db.get('SELECT * FROM allotments WHERE id = ?', [id]);
};

const insertAllotment = async (allotmentData) => {
  const db = await getDatabase();
  const { resident_id, room_id, status } = allotmentData || {};

  const parsedResidentId = Number(resident_id);
  if (!Number.isInteger(parsedResidentId) || parsedResidentId <= 0) {
    throw new Error('Invalid resident_id. It must be a positive integer.');
  }

  const parsedRoomId = Number(room_id);
  if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
    throw new Error('Invalid room_id. It must be a positive integer.');
  }

  // Allotment starts as 'pending' by default per Client Brief Test 1
  const initialStatus = status || 'pending';
  if (!['pending', 'approved', 'done'].includes(initialStatus)) {
    throw new Error('Invalid status. Status must be "pending", "approved", or "done".');
  }

  const result = await db.run(
    'INSERT INTO allotments (resident_id, room_id, status) VALUES (?, ?, ?)',
    [parsedResidentId, parsedRoomId, initialStatus]
  );

  return {
    id: result.lastID,
    resident_id: parsedResidentId,
    room_id: parsedRoomId,
    status: initialStatus,
  };
};

const deleteAllotment = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error('Invalid allotment ID. ID must be a positive integer.');
  }

  const db = await getDatabase();
  const result = await db.run('DELETE FROM allotments WHERE id = ?', [parsedId]);
  return result.changes > 0;
};

/**
 * ============================================================================
 * REUSABLE OPERATIONS: ALLOTMENTS WITH DETAILS (JOIN QUERIES)
 * ============================================================================
 */
const getAllAllotmentsWithDetails = async () => {
  const db = await getDatabase();
  return db.all(`${ALLOTMENTS_JOIN_QUERY} ORDER BY allotments.id ASC`);
};

const getAllotmentWithDetailsById = async (id) => {
  const db = await getDatabase();
  return db.get(`${ALLOTMENTS_JOIN_QUERY} WHERE allotments.id = ?`, [id]);
};

const getAllotmentsByResidentId = async (residentId) => {
  const db = await getDatabase();
  return db.all(
    `${ALLOTMENTS_JOIN_QUERY} WHERE allotments.resident_id = ? ORDER BY allotments.id ASC`,
    [residentId]
  );
};

const getAllotmentsByRoomId = async (roomId) => {
  const db = await getDatabase();
  return db.all(
    `${ALLOTMENTS_JOIN_QUERY} WHERE allotments.room_id = ? ORDER BY allotments.id ASC`,
    [roomId]
  );
};

const getAllotmentsByStatus = async (status) => {
  const db = await getDatabase();
  return db.all(
    `${ALLOTMENTS_JOIN_QUERY} WHERE allotments.status = ? ORDER BY allotments.id ASC`,
    [status]
  );
};

module.exports = {
  // Database instance & connection management
  getDatabase,
  initializeDatabase,
  closeDatabase,
  DB_PATH,

  // Table creation statements
  CREATE_RESIDENTS_TABLE,
  CREATE_ROOMS_TABLE,
  CREATE_ALLOTMENTS_TABLE,

  // SQL JOIN Query string
  ALLOTMENTS_JOIN_QUERY,

  // Residents operations
  getAllResidents,
  getResidentById,
  insertResident,
  createResident: insertResident,
  updateResident,
  deleteResident,

  // Rooms operations
  getAllRooms,
  getRoomById,
  getRoomsByBlock,
  insertRoom,
  createRoom: insertRoom,
  updateRoom,
  deleteRoom,

  // Allotment operations
  getAllAllotments,
  getAllotmentById,
  insertAllotment,
  createAllotment: insertAllotment,
  deleteAllotment,

  // JOIN query operations
  getAllAllotmentsWithDetails,
  getAllotmentWithDetailsById,
  getAllotmentsByResidentId,
  getAllotmentsByRoomId,
  getAllotmentsByStatus,
};
