const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    logger.info(`📥 ${req.method} ${req.path}`);
    next();
});

// Health check (before routes)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
logger.info('🚀 Mounting /api routes');
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: {
            message: 'Route not found',
            path: req.path
        }
    });
});

// Error handling (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info('╔════════════════════════════════════════╗');
    logger.info('║   Cash Flow Server                     ║');
    logger.info(`║   Running on http://localhost:${PORT}    ║`);
    logger.info(`║   Environment: ${process.env.NODE_ENV || 'development'}              ║`);
    logger.info('╚════════════════════════════════════════╝');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.warn('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        logger.info('HTTP server closed');
    });
});
