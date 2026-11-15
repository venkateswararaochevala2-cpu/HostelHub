const express = require('express');
const router = express.Router();
const {
  getDatabase,
  getAllResidents,
  getResidentById,
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
// 1. GET /residents - Get all residents (with optional ?department= query)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { department } = req.query;
    const db = await getDatabase();

    if (department !== undefined) {
      if (typeof department !== 'string' || !department.trim()) {
        return res.status(400).json({
          error: 'Invalid department query parameter. It must be a non-empty string.',
        });
      }

      const trimmedDept = department.trim();
      const residents = await db.all(
        'SELECT * FROM residents WHERE LOWER(department) LIKE LOWER(?) ORDER BY id ASC',
        [`%${trimmedDept}%`]
      );
      return res.status(200).json(residents);
    }

    const residents = await getAllResidents();
    return res.status(200).json(residents);
  } catch (error) {
    console.error('Error fetching residents:', error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching residents',
      details: error.message,
    });
  }
});

// ============================================================================
// 2. GET /residents/:id - Get one resident by ID
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const residentId = parsePositiveIntegerId(req.params.id);
    if (!residentId) {
      return res.status(400).json({
        error: 'Invalid resident ID. ID must be a positive integer.',
      });
    }

    const resident = await getResidentById(residentId);
    if (!resident) {
      return res.status(404).json({
        error: `Resident with ID ${residentId} not found`,
      });
    }

    return res.status(200).json(resident);
  } catch (error) {
    console.error(`Error fetching resident ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while fetching resident',
      details: error.message,
    });
  }
});

// ============================================================================
// 3. POST /residents - Add a new resident
// ============================================================================
router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body. Request body must be a JSON object.',
      });
    }

    const { id, name, roll_number, department } = req.body;

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "name" is required and must be a non-empty string.',
      });
    }

    // Validate roll_number
    if (typeof roll_number !== 'string' || !roll_number.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "roll_number" is required and must be a non-empty string.',
      });
    }

    // Validate department
    if (typeof department !== 'string' || !department.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "department" is required and must be a non-empty string.',
      });
    }

    const trimmedName = name.trim();
    const trimmedRoll = roll_number.trim();
    const trimmedDept = department.trim();

    const db = await getDatabase();

    // Check duplicate roll number
    const existingRoll = await db.get(
      'SELECT * FROM residents WHERE LOWER(roll_number) = LOWER(?)',
      [trimmedRoll]
    );
    if (existingRoll) {
      return res.status(409).json({
        error: `Resident with roll number "${trimmedRoll}" already exists.`,
      });
    }

    let newId;
    if (id !== undefined) {
      const explicitId = parsePositiveIntegerId(id);
      if (!explicitId) {
        return res.status(400).json({
          error: 'Invalid resident ID. If provided, "id" must be a positive integer.',
        });
      }

      const idExists = await db.get('SELECT * FROM residents WHERE id = ?', [explicitId]);
      if (idExists) {
        return res.status(400).json({
          error: `Resident with ID ${explicitId} already exists.`,
        });
      }

      await db.run(
        'INSERT INTO residents (id, name, roll_number, department) VALUES (?, ?, ?, ?)',
        [explicitId, trimmedName, trimmedRoll, trimmedDept]
      );
      newId = explicitId;
    } else {
      const result = await db.run(
        'INSERT INTO residents (name, roll_number, department) VALUES (?, ?, ?)',
        [trimmedName, trimmedRoll, trimmedDept]
      );
      newId = result.lastID;
    }

    return res.status(201).json({
      message: 'Resident created successfully',
      resident: {
        id: newId,
        name: trimmedName,
        roll_number: trimmedRoll,
        department: trimmedDept,
      },
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Resident with this roll number already exists.',
      });
    }
    console.error('Error creating resident:', error.message);
    return res.status(500).json({
      error: 'Internal server error while creating resident',
      details: error.message,
    });
  }
});

// ============================================================================
// 4. PUT /residents/:id - Update an existing resident
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const residentId = parsePositiveIntegerId(req.params.id);
    if (!residentId) {
      return res.status(400).json({
        error: 'Invalid resident ID. ID must be a positive integer.',
      });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Invalid request body. Request body must be a JSON object.',
      });
    }

    const { name, roll_number, department } = req.body;

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "name" is required and must be a non-empty string.',
      });
    }

    // Validate roll_number
    if (typeof roll_number !== 'string' || !roll_number.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "roll_number" is required and must be a non-empty string.',
      });
    }

    // Validate department
    if (typeof department !== 'string' || !department.trim()) {
      return res.status(400).json({
        error: 'Invalid request body. "department" is required and must be a non-empty string.',
      });
    }

    const trimmedName = name.trim();
    const trimmedRoll = roll_number.trim();
    const trimmedDept = department.trim();

    const db = await getDatabase();

    // Check if resident exists before updating
    const existing = await db.get('SELECT * FROM residents WHERE id = ?', [residentId]);
    if (!existing) {
      return res.status(404).json({
        error: `Resident with ID ${residentId} not found`,
      });
    }

    // Check if roll number conflicts with another resident
    const conflict = await db.get(
      'SELECT * FROM residents WHERE LOWER(roll_number) = LOWER(?) AND id != ?',
      [trimmedRoll, residentId]
    );
    if (conflict) {
      return res.status(409).json({
        error: `Resident with roll number "${trimmedRoll}" already exists.`,
      });
    }

    await db.run(
      'UPDATE residents SET name = ?, roll_number = ?, department = ? WHERE id = ?',
      [trimmedName, trimmedRoll, trimmedDept, residentId]
    );

    return res.status(200).json({
      message: 'Resident updated successfully',
      resident: {
        id: residentId,
        name: trimmedName,
        roll_number: trimmedRoll,
        department: trimmedDept,
      },
    });
  } catch (error) {
    console.error(`Error updating resident ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while updating resident',
      details: error.message,
    });
  }
});

// ============================================================================
// 5. DELETE /residents/:id - Delete a resident by ID
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const residentId = parsePositiveIntegerId(req.params.id);
    if (!residentId) {
      return res.status(400).json({
        error: 'Invalid resident ID. ID must be a positive integer.',
      });
    }

    const db = await getDatabase();

    // Check if resident exists before deleting
    const existing = await db.get('SELECT * FROM residents WHERE id = ?', [residentId]);
    if (!existing) {
      return res.status(404).json({
        error: `Resident with ID ${residentId} not found`,
      });
    }

    // Check if resident has allotments
    const allotmentRef = await db.get(
      'SELECT id FROM allotments WHERE resident_id = ? LIMIT 1',
      [residentId]
    );
    if (allotmentRef) {
      return res.status(409).json({
        error: 'Cannot delete resident with existing allotments.',
      });
    }

    await db.run('DELETE FROM residents WHERE id = ?', [residentId]);

    return res.status(200).json({
      message: `Resident with ID ${residentId} deleted successfully`,
    });
  } catch (error) {
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(409).json({
        error: 'Cannot delete resident with existing allotments.',
      });
    }
    console.error(`Error deleting resident ${req.params.id}:`, error.message);
    return res.status(500).json({
      error: 'Internal server error while deleting resident',
      details: error.message,
    });
  }
});

module.exports = router;
