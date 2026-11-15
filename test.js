/**
 * test.js
 * Comprehensive automated test suite for HostelHub:
 * 1. Server & Route Mounting (GET /, GET /health, 404 handler)
 * 2. SQLite Database & Schema (residents, rooms, allotments)
 * 3. Rooms CRUD & Validation (GET all, GET one, POST, PUT, DELETE, 400, 404)
 * 4. Search Rooms by Block Query Parameter (GET /rooms?block=Block A)
 * 5. Residents CRUD & Validation (GET all, GET one, POST, PUT, DELETE)
 * 6. SQL JOIN Endpoint (Allotments with resident name and room name)
 * 7. Twist Rule: Status Flow (Tests 1, 2, and 3 from Client Brief)
 */

const http = require('http');
const { app } = require('./app');
const { initializeDatabase } = require('./database');

const runTests = async () => {
  console.log('====================================================');
  console.log(' HostelHub - Automated Test Suite');
  console.log('====================================================\n');

  await initializeDatabase();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  const request = (path, options = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const reqOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      };

      const req = http.request(url, reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', reject);
      if (body !== null) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  };

  let passed = 0;
  let total = 0;

  const assert = (condition, testName, details = '') => {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
    }
  };

  try {
    // ------------------------------------------------------------------------
    // 1. Server & Routing Tests
    // ------------------------------------------------------------------------
    console.log('--- 1. Server & Health Check Endpoints ---');
    const rootRes = await request('/');
    assert(rootRes.status === 200, 'GET / returns 200 OK');
    assert(rootRes.body && rootRes.body.status === 'Server active', 'GET / returns server status');

    const healthRes = await request('/health');
    assert(healthRes.status === 200, 'GET /health returns 200 OK');

    const notFoundRes = await request('/unknown-route');
    assert(notFoundRes.status === 404, 'Unknown route returns 404 Not Found');

    // ------------------------------------------------------------------------
    // 2. Rooms CRUD & Search by Query Parameter
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Rooms CRUD & Query Search (Client Brief) ---');
    const allRoomsRes = await request('/rooms');
    assert(allRoomsRes.status === 200, 'GET /rooms returns 200 OK');
    assert(Array.isArray(allRoomsRes.body), 'GET /rooms returns array of rooms');

    // Query parameter search: rooms by block
    const blockSearchRes = await request('/rooms?block=Block A');
    assert(blockSearchRes.status === 200, 'GET /rooms?block=Block A returns 200 OK');
    assert(Array.isArray(blockSearchRes.body) && blockSearchRes.body.length > 0, 'Search by block returns matching rooms');
    assert(blockSearchRes.body.every(r => r.block.toLowerCase().includes('block a')), 'All filtered rooms belong to Block A');

    // Create room (POST /rooms)
    const createRoomRes = await request('/rooms', { method: 'POST' }, {
      name: 'Room 501',
      block: 'Block E',
    });
    assert(createRoomRes.status === 201, 'POST /rooms returns 201 Created');
    assert(createRoomRes.body.room && createRoomRes.body.room.name === 'Room 501', 'Created room has correct name');
    const roomId = createRoomRes.body.room.id;

    // Get room by ID (GET /rooms/:id)
    const getRoomRes = await request(`/rooms/${roomId}`);
    assert(getRoomRes.status === 200, 'GET /rooms/:id returns 200 OK');
    assert(getRoomRes.body.id === roomId, 'Retrieved room matches requested ID');

    // Update room (PUT /rooms/:id)
    const updateRoomRes = await request(`/rooms/${roomId}`, { method: 'PUT' }, {
      name: 'Room 501-Renovated',
      block: 'Block E',
    });
    assert(updateRoomRes.status === 200, 'PUT /rooms/:id returns 200 OK');
    assert(updateRoomRes.body.room.name === 'Room 501-Renovated', 'Updated room name is saved');

    // Validation checks on rooms
    const invalidRoomId = await request('/rooms/not-an-id');
    assert(invalidRoomId.status === 400, 'GET /rooms with invalid ID returns 400 Bad Request');

    const missingBlockRes = await request('/rooms', { method: 'POST' }, { name: 'Only Name' });
    assert(missingBlockRes.status === 400, 'POST /rooms missing block returns 400 Bad Request');

    const notFoundRoom = await request('/rooms/999999');
    assert(notFoundRoom.status === 404, 'GET /rooms/999999 returns 404 Not Found');

    // Delete room (DELETE /rooms/:id)
    const deleteRoomRes = await request(`/rooms/${roomId}`, { method: 'DELETE' });
    assert(deleteRoomRes.status === 200, 'DELETE /rooms/:id returns 200 OK');

    const verifyDeletedRoom = await request(`/rooms/${roomId}`);
    assert(verifyDeletedRoom.status === 404, 'GET deleted room returns 404 Not Found');

    // ------------------------------------------------------------------------
    // 3. Residents CRUD & Validation
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Residents CRUD & Validation ---');
    const allResidentsRes = await request('/residents');
    assert(allResidentsRes.status === 200, 'GET /residents returns 200 OK');
    assert(Array.isArray(allResidentsRes.body), 'GET /residents returns array of residents');

    const createResidentRes = await request('/residents', { method: 'POST' }, {
      name: 'Test Resident',
      roll_number: '21CS999',
      department: 'Computer Science',
    });
    assert(createResidentRes.status === 201, 'POST /residents returns 201 Created');
    const residentId = createResidentRes.body.resident.id;

    const getResidentRes = await request(`/residents/${residentId}`);
    assert(getResidentRes.status === 200, 'GET /residents/:id returns 200 OK');

    const updateResidentRes = await request(`/residents/${residentId}`, { method: 'PUT' }, {
      name: 'Test Resident Updated',
      roll_number: '21CS999',
      department: 'Information Tech',
    });
    assert(updateResidentRes.status === 200, 'PUT /residents/:id returns 200 OK');

    const dupRollRes = await request('/residents', { method: 'POST' }, {
      name: 'Duplicate Person',
      roll_number: '21CS999',
      department: 'CSE',
    });
    assert(dupRollRes.status === 409, 'POST /residents with duplicate roll returns 409 Conflict');

    // ------------------------------------------------------------------------
    // 4. SQL JOIN Endpoint (Allotments with resident and room details)
    // ------------------------------------------------------------------------
    console.log('\n--- 4. SQL JOIN Endpoint (Resident & Room Names) ---');
    const joinRes = await request('/allotments');
    assert(joinRes.status === 200, 'GET /allotments returns 200 OK');
    assert(Array.isArray(joinRes.body) && joinRes.body.length > 0, 'GET /allotments returns joined array');

    const firstJoin = joinRes.body[0];
    assert(firstJoin.resident_name !== undefined, 'Joined record contains resident_name');
    assert(firstJoin.room_name !== undefined, 'Joined record contains room_name');
    assert(firstJoin.room_block !== undefined, 'Joined record contains room_block');
    assert(firstJoin.status !== undefined, 'Joined record contains status');

    // ------------------------------------------------------------------------
    // 5. Twist Rule: Status Flow (Client Brief Tests 1, 2, and 3)
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Twist Rule: Status Flow (Client Brief Tests 1, 2, 3) ---');

    // TEST 1: Add allotment -> starts as pending, 201
    const test1Res = await request('/allotments', { method: 'POST' }, {
      resident_id: residentId,
      room_id: 1,
    });
    assert(test1Res.status === 201, 'Test 1: Add an allotment returns 201 Created');
    assert(test1Res.body.allotment && test1Res.body.allotment.status === 'pending', 'Test 1: Allotment starts as "pending"');
    const allotmentId = test1Res.body.allotment.id;

    // TEST 2: pending -> approved -> 200
    const test2Res = await request(`/allotments/${allotmentId}/status`, { method: 'PATCH' }, {
      status: 'approved',
    });
    assert(test2Res.status === 200, 'Test 2: pending -> approved returns 200 OK');
    assert(test2Res.body.allotment && test2Res.body.allotment.status === 'approved', 'Allotment status updated to "approved"');

    // TEST 3: approved -> pending -> 400 ("Invalid status change")
    const test3Res = await request(`/allotments/${allotmentId}/status`, { method: 'PATCH' }, {
      status: 'pending',
    });
    assert(test3Res.status === 400, 'Test 3: approved -> pending returns 400 Bad Request');
    assert(test3Res.body && test3Res.body.error === 'Invalid status change', 'Test 3: Returns exact message "Invalid status change"');

    // Additional step: approved -> done -> 200
    const forwardToDone = await request(`/allotments/${allotmentId}/status`, { method: 'PATCH' }, {
      status: 'done',
    });
    assert(forwardToDone.status === 200, 'approved -> done returns 200 OK');

    // Backward from done -> 400
    const doneToPending = await request(`/allotments/${allotmentId}/status`, { method: 'PATCH' }, {
      status: 'pending',
    });
    assert(doneToPending.status === 400, 'done -> pending returns 400 Bad Request ("Invalid status change")');

    // Clean up test records
    await request(`/allotments/${allotmentId}`, { method: 'DELETE' });
    await request(`/residents/${residentId}`, { method: 'DELETE' });

    console.log('\n====================================================');
    console.log(` Results: ${passed} / ${total} tests passed.`);
    console.log('====================================================\n');
  } finally {
    server.close();
  }

  if (passed !== total) {
    process.exit(1);
  }
};

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
