const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { getPool, closePool } = require('./db/connection');

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
app.get('/health', async (req, res) => {
    let database = 'OK';
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS ok');
    } catch (err) {
        database = `ERROR: ${err.message}`;
    }

    res.status(database === 'OK' ? 200 : 503).json({
        status: database === 'OK' ? 'OK' : 'DEGRADED',
        database,
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

// Start server (connect to SQL Server first, so a bad connection string fails immediately)
let server;

async function start() {
    try {
        await getPool();
    } catch (err) {
        logger.error(`❌ Could not connect to SQL Server: ${err.message}`);
        logger.error('   Check DB_CONNECTION_STRING in server/.env and that the CashFlowDB database exists (db/schema.sql).');
        process.exit(1);
    }

    server = app.listen(PORT, () => {
        logger.info('╔════════════════════════════════════════╗');
        logger.info('║   Cash Flow Server                     ║');
        logger.info(`║   Running on http://localhost:${PORT}    ║`);
        logger.info(`║   Environment: ${process.env.NODE_ENV || 'development'}              ║`);
        logger.info('╚════════════════════════════════════════╝');
    });
}

start();

// Graceful shutdown
async function shutdown(signal) {
    logger.warn(`${signal} signal received: closing HTTP server`);
    const finish = async () => {
        try {
            await closePool();
        } catch (err) {
            logger.error(`Error closing SQL pool: ${err.message}`);
        }
        logger.info('HTTP server closed');
        process.exit(0);
    };

    if (server) {
        server.close(finish);
    } else {
        await finish();
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
