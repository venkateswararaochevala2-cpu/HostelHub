const express = require('express');
const roomsRouter = require('./routes/rooms');
const residentsRouter = require('./routes/residents');
const allotmentsRouter = require('./routes/allotments');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware Configuration
// ============================================================================
app.use(express.json());
app.set('json spaces', 2);

// ============================================================================
// Root / Health Check Route
// ============================================================================
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to HostelHub API',
    project: 'Room Allotment Management System',
    theme: 'Theme 10 of 30 · Room allotment',
    brief: 'Rooms are allotted from a paper file. The warden cannot quickly tell which rooms are free in each block. Please build us a system that fixes this.',
    status: 'Server active',
    endpoints: {
      rooms: {
        getAll: 'GET /rooms',
        searchByBlock: 'GET /rooms?block=Block%20A',
        getOne: 'GET /rooms/:id',
        create: 'POST /rooms',
        update: 'PUT /rooms/:id',
        delete: 'DELETE /rooms/:id',
      },
      residents: {
        getAll: 'GET /residents',
        getOne: 'GET /residents/:id',
        create: 'POST /residents',
        update: 'PUT /residents/:id',
        delete: 'DELETE /residents/:id',
      },
      allotments: {
        getAll: 'GET /allotments',
        getDetails: 'GET /allotments/details',
        getDetailsById: 'GET /allotments/details/:id',
        getOne: 'GET /allotments/:id',
        create: 'POST /allotments (starts as pending)',
        updateStatus: 'PATCH /allotments/:id/status (twist: pending -> approved -> done)',
        delete: 'DELETE /allotments/:id',
      },
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'HostelHub server is running and healthy',
  });
});

// ============================================================================
// Route Mounting
// ============================================================================
app.use('/rooms', roomsRouter);
app.use('/residents', residentsRouter);
app.use('/allotments', allotmentsRouter);

// ============================================================================
// 404 Not Found Handler for Unmatched Routes
// ============================================================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    requestedUrl: req.originalUrl,
  });
});

// ============================================================================
// Global Error Handler
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

// ============================================================================
// Server Listening Configuration
// ============================================================================
const startServer = async () => {
  try {
    // Establish database connection interface and initialize schema
    await initializeDatabase();

    const server = app.listen(PORT, () => {
      console.log(`HostelHub server running at: http://localhost:${PORT}`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start server when executed directly (node app.js)
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
