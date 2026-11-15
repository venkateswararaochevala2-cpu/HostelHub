const express = require('express');
const router = express.Router();
const { getDatabase, getAllRooms, getRoomById } = require('../database');

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
// 1. GET /rooms - Get all rooms (with optional ?block= query parameter search)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { block } = req.query;
    const db = await getDatabase();

    // Block search filter: GET /rooms?block=Block%20A or GET /rooms?block=A
    if (block !== undefined) {
      if (typeof block !== 'string' || !block.trim()) {
        return res.status(400).json({
          error: 'Invalid block query parameter. It must be a non-empty string.',
        });
      }

      const trimmedBlock = block.trim();
      const rooms = await db.all(
        'SELECT * FROM rooms WHERE LOWER(block) LIKE LOWER(?) OR LOWER(block) = LOWER(?) ORDER BY id ASC',
        [`%${trimmedBlock}%`, trimmedBlock]
      );
      return res.status(200).json(rooms);
    }

    const rooms = await getAllRooms();
    return res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching rooms',
      details: error.message,
    });
  }
});

// ============================================================================
// 2. GET /rooms/:id - Get one room by ID
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const roomId = parsePositiveIntegerId(req.params.id);
    if (!roomId) {
      return res.status(400).json({
        error: 'Invalid room ID. ID must be a positive integer.',
      });
    }

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({
        error: `Room with ID ${roomId} not found`,
      });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error(`Error fetching room ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching room',
      details: error.message,
    });
  }
});

// ============================================================================
// 3. POST /rooms - Add a new room
// ============================================================================
router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body. Request body must be a JSON object.',
      });
    }

    const { id, name, block } = req.body;

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "name" is required and must be a non-empty string.',
      });
    }

    // Validate block
    if (typeof block !== 'string' || !block.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "block" is required and must be a non-empty string.',
      });
    }

    const trimmedName = name.trim();
    const trimmedBlock = block.trim();

    const db = await getDatabase();

    // Check for duplicate room in block
    const existing = await db.get(
      'SELECT * FROM rooms WHERE LOWER(name) = LOWER(?) AND LOWER(block) = LOWER(?)',
      [trimmedName, trimmedBlock]
    );
    if (existing) {
      return res.status(409).json({
        error: `Room "${trimmedName}" already exists in ${trimmedBlock}.`,
      });
    }

    let newId;
    if (id !== undefined) {
      const explicitId = parsePositiveIntegerId(id);
      if (!explicitId) {
        return res.status(400).json({
          error: 'Invalid room ID. If provided, "id" must be a positive integer.',
        });
      }

      const idExists = await db.get('SELECT * FROM rooms WHERE id = ?', [explicitId]);
      if (idExists) {
        return res.status(400).json({
          error: `Room with ID ${explicitId} already exists.`,
        });
      }

      await db.run(
        'INSERT INTO rooms (id, name, block) VALUES (?, ?, ?)',
        [explicitId, trimmedName, trimmedBlock]
      );
      newId = explicitId;
    } else {
      const result = await db.run(
        'INSERT INTO rooms (name, block) VALUES (?, ?)',
        [trimmedName, trimmedBlock]
      );
      newId = result.lastID;
    }

    return res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: newId,
        name: trimmedName,
        block: trimmedBlock,
      },
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'This room already exists in this block.',
      });
    }
    console.error('Error creating room:', error.message);
    return res.status(500).json({
      error: 'Internal server error while creating room',
      details: error.message,
    });
  }
});

// ============================================================================
// 4. PUT /rooms/:id - Update an existing room
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const roomId = parsePositiveIntegerId(req.params.id);
    if (!roomId) {
      return res.status(400).json({
        error: 'Invalid room ID. ID must be a positive integer.',
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body. Request body must be a JSON object.',
      });
    }

    const { name, block } = req.body;

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "name" is required and must be a non-empty string.',
      });
    }

    // Validate block
    if (typeof block !== 'string' || !block.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "block" is required and must be a non-empty string.',
      });
    }

    const trimmedName = name.trim();
    const trimmedBlock = block.trim();

    const db = await getDatabase();

    // Check if room exists before updating
    const existing = await db.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!existing) {
      return res.status(404).json({
        error: `Room with ID ${roomId} not found`,
      });
    }

    // Check if new name/block conflicts with another room
    const conflict = await db.get(
      'SELECT * FROM rooms WHERE LOWER(name) = LOWER(?) AND LOWER(block) = LOWER(?) AND id != ?',
      [trimmedName, trimmedBlock, roomId]
    );
    if (conflict) {
      return res.status(409).json({
        error: `Room "${trimmedName}" already exists in ${trimmedBlock}.`,
      });
    }

    await db.run(
      'UPDATE rooms SET name = ?, block = ? WHERE id = ?',
      [trimmedName, trimmedBlock, roomId]
    );

    return res.status(200).json({
      message: 'Room updated successfully',
      room: {
        id: roomId,
        name: trimmedName,
        block: trimmedBlock,
      },
    });
  } catch (error) {
    console.error(`Error updating room ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while updating room',
      details: error.message,
    });
  }
});

// ============================================================================
// 5. DELETE /rooms/:id - Delete a room by ID
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const roomId = parsePositiveIntegerId(req.params.id);
    if (!roomId) {
      return res.status(400).json({
        error: 'Invalid room ID. ID must be a positive integer.',
      });
    }

    const db = await getDatabase();

    // Check if room exists before deleting
    const existing = await db.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!existing) {
      return res.status(404).json({
        error: `Room with ID ${roomId} not found`,
      });
    }

    // Check if room is referenced by any allotments
    const allotmentRef = await db.get(
      'SELECT id FROM allotments WHERE room_id = ? LIMIT 1',
      [roomId]
    );
    if (allotmentRef) {
      return res.status(409).json({
        error: 'Cannot delete room with existing allotments.',
      });
    }

    await db.run('DELETE FROM rooms WHERE id = ?', [roomId]);

    return res.status(200).json({
      message: `Room with ID ${roomId} deleted successfully`,
    });
  } catch (error) {
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(409).json({
        error: 'Cannot delete room with existing allotments.',
      });
    }
    console.error(`Error deleting room ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while deleting room',
      details: error.message,
    });
  }
});

module.exports = router;
