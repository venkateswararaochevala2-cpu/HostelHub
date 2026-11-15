const express = require('express');
const router = express.Router();
const {
  getDatabase,
  getAllAllotmentsWithDetails,
  getAllotmentWithDetailsById,
  getAllotmentsByResidentId,
  getAllotmentsByRoomId,
  getAllotmentsByStatus,
  getResidentById,
  getRoomById,
  ALLOTMENTS_JOIN_QUERY,
} = require('../database');

/**
 * Helper to validate positive integer IDs.
 * Returns the parsed integer if valid, or null if invalid.
 */
const parsePositiveIntegerId = (idParam) => {
  const parsed = Number(idParam);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

// ============================================================================
// 1. GET /allotments/details - Join Endpoint with resident & room details
// (Registered BEFORE /:id to prevent route shadowing)
// ============================================================================
router.get('/details', async (req, res) => {
  try {
    const { resident_id, room_id, status } = req.query;

    if (resident_id !== undefined) {
      const parsedResId = parsePositiveIntegerId(resident_id);
      if (!parsedResId) {
        return res.status(400).json({
          error: 'Invalid resident_id query parameter. Must be a positive integer.',
        });
      }
      const records = await getAllotmentsByResidentId(parsedResId);
      return res.status(200).json(records);
    }

    if (room_id !== undefined) {
      const parsedRoomId = parsePositiveIntegerId(room_id);
      if (!parsedRoomId) {
        return res.status(400).json({
          error: 'Invalid room_id query parameter. Must be a positive integer.',
        });
      }
      const records = await getAllotmentsByRoomId(parsedRoomId);
      return res.status(200).json(records);
    }

    if (status !== undefined) {
      const records = await getAllotmentsByStatus(status.trim());
      return res.status(200).json(records);
    }

    const allotments = await getAllAllotmentsWithDetails();
    return res.status(200).json(allotments);
  } catch (error) {
    console.error('Error fetching allotment details:', error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching allotment details',
      details: error.message,
    });
  }
});

// ============================================================================
// 2. GET /allotments/details/:id - Single Join Endpoint by allotment ID
// (Registered BEFORE /:id to prevent route shadowing)
// ============================================================================
router.get('/details/:id', async (req, res) => {
  try {
    const allotmentId = parsePositiveIntegerId(req.params.id);
    if (!allotmentId) {
      return res.status(400).json({
        error: 'Invalid allotment ID. ID must be a positive integer.',
      });
    }

    const record = await getAllotmentWithDetailsById(allotmentId);
    if (!record) {
      return res.status(404).json({
        error: `Allotment with ID ${allotmentId} not found`,
      });
    }

    return res.status(200).json(record);
  } catch (error) {
    console.error(`Error fetching allotment detail ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching allotment detail',
      details: error.message,
    });
  }
});

// ============================================================================
// 3. GET /allotments - Get all allotments with resident & room JOIN details
// (Supports query filters: ?status=, ?block=, ?resident_id=, ?room_id=)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { status, block, resident_id, room_id } = req.query;
    const db = await getDatabase();

    const conditions = [];
    const params = [];

    if (status !== undefined) {
      conditions.push('allotments.status = ?');
      params.push(status.trim());
    }

    if (block !== undefined) {
      conditions.push('LOWER(rooms.block) LIKE LOWER(?)');
      params.push(`%${block.trim()}%`);
    }

    if (resident_id !== undefined) {
      const parsedResId = parsePositiveIntegerId(resident_id);
      if (!parsedResId) {
        return res.status(400).json({
          error: 'Invalid resident_id query parameter. Must be a positive integer.',
        });
      }
      conditions.push('allotments.resident_id = ?');
      params.push(parsedResId);
    }

    if (room_id !== undefined) {
      const parsedRoomId = parsePositiveIntegerId(room_id);
      if (!parsedRoomId) {
        return res.status(400).json({
          error: 'Invalid room_id query parameter. Must be a positive integer.',
        });
      }
      conditions.push('allotments.room_id = ?');
      params.push(parsedRoomId);
    }

    let query = ALLOTMENTS_JOIN_QUERY;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY allotments.id ASC';

    const records = await db.all(query, params);
    return res.status(200).json(records);
  } catch (error) {
    console.error('Error fetching allotments:', error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching allotments',
      details: error.message,
    });
  }
});

// ============================================================================
// 4. GET /allotments/:id - Get one allotment by ID with joined details
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const allotmentId = parsePositiveIntegerId(req.params.id);
    if (!allotmentId) {
      return res.status(400).json({
        error: 'Invalid allotment ID. ID must be a positive integer.',
      });
    }

    const allotment = await getAllotmentWithDetailsById(allotmentId);
    if (!allotment) {
      return res.status(404).json({
        error: `Allotment with ID ${allotmentId} not found`,
      });
    }

    return res.status(200).json(allotment);
  } catch (error) {
    console.error(`Error fetching allotment ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching allotment',
      details: error.message,
    });
  }
});

// ============================================================================
// 5. POST /allotments - Add a new allotment (Starts as 'pending', 201)
// Client Brief Test 1: Add a allotment -> starts as pending, 201
// ============================================================================
router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body. Request body must be a JSON object.',
      });
    }

    const { resident_id, room_id } = req.body;

    // Validate resident_id
    const parsedResidentId = parsePositiveIntegerId(resident_id);
    if (!parsedResidentId) {
      return res.status(400).json({
        error: 'Invalid resident_id. It must be a positive integer.',
      });
    }

    // Validate room_id
    const parsedRoomId = parsePositiveIntegerId(room_id);
    if (!parsedRoomId) {
      return res.status(400).json({
        error: 'Invalid room_id. It must be a positive integer.',
      });
    }

    // Foreign key existence check
    const resident = await getResidentById(parsedResidentId);
    if (!resident) {
      return res.status(404).json({
        error: `Resident with ID ${parsedResidentId} not found. Cannot create allotment.`,
      });
    }

    const room = await getRoomById(parsedRoomId);
    if (!room) {
      return res.status(404).json({
        error: `Room with ID ${parsedRoomId} not found. Cannot create allotment.`,
      });
    }

    const db = await getDatabase();

    // Client Brief Twist Rule: New allotment always starts as 'pending'
    const result = await db.run(
      'INSERT INTO allotments (resident_id, room_id, status) VALUES (?, ?, ?)',
      [parsedResidentId, parsedRoomId, 'pending']
    );

    const createdAllotment = await getAllotmentWithDetailsById(result.lastID);

    return res.status(201).json({
      message: 'Allotment created successfully',
      allotment: createdAllotment,
    });
  } catch (error) {
    console.error('Error creating allotment:', error.message);
    return res.status(500).json({
      error: 'Internal server error while creating allotment',
      details: error.message,
    });
  }
});

// ============================================================================
// 6. PATCH /allotments/:id/status - Update allotment status (Twist Rule)
// Client Brief Twist Rule:
// - Status flow: pending -> approved -> done
// - Only moves one step forward.
// - Any other move gets 400 and the message "Invalid status change".
// Test 2: pending -> approved -> 200
// Test 3: approved -> pending -> 400 ("Invalid status change")
// ============================================================================
router.patch('/:id/status', async (req, res) => {
  try {
    const allotmentId = parsePositiveIntegerId(req.params.id);
    if (!allotmentId) {
      return res.status(400).json({
        error: 'Invalid allotment ID. ID must be a positive integer.',
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid status change',
      });
    }

    const { status } = req.body;
    if (typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({
        error: 'Invalid status change',
      });
    }

    const targetStatus = status.trim().toLowerCase();

    const db = await getDatabase();
    const allotment = await db.get('SELECT * FROM allotments WHERE id = ?', [allotmentId]);

    if (!allotment) {
      return res.status(404).json({
        error: `Allotment with ID ${allotmentId} not found`,
      });
    }

    const currentStatus = allotment.status;

    // Twist Rule: Valid forward-only one-step status transitions
    const allowedTransitions = {
      pending: 'approved',
      approved: 'done',
    };

    if (allowedTransitions[currentStatus] !== targetStatus) {
      return res.status(400).json({
        error: 'Invalid status change',
        current_status: currentStatus,
        requested_status: targetStatus,
      });
    }

    await db.run('UPDATE allotments SET status = ? WHERE id = ?', [targetStatus, allotmentId]);

    const updatedAllotment = await getAllotmentWithDetailsById(allotmentId);

    return res.status(200).json({
      message: 'Allotment status updated successfully',
      allotment: updatedAllotment,
    });
  } catch (error) {
    console.error(`Error updating allotment status ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while updating allotment status',
      details: error.message,
    });
  }
});

// ============================================================================
// 7. DELETE /allotments/:id - Delete an allotment by ID
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const allotmentId = parsePositiveIntegerId(req.params.id);
    if (!allotmentId) {
      return res.status(400).json({
        error: 'Invalid allotment ID. ID must be a positive integer.',
      });
    }

    const db = await getDatabase();
    const existing = await db.get('SELECT * FROM allotments WHERE id = ?', [allotmentId]);
    if (!existing) {
      return res.status(404).json({
        error: `Allotment with ID ${allotmentId} not found`,
      });
    }

    await db.run('DELETE FROM allotments WHERE id = ?', [allotmentId]);

    return res.status(200).json({
      message: `Allotment with ID ${allotmentId} deleted successfully`,
    });
  } catch (error) {
    console.error(`Error deleting allotment ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while deleting allotment',
      details: error.message,
    });
  }
});

module.exports = router;
