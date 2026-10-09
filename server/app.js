/**
 * Builds the Express application (no listening, no DB connection) so it can be
 * started by index.js and exercised by the tests without a database.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const { getPool } = require('./db/connection');
const financialSummary = require('./services/financialSummary.service');

const DEFAULT_ORIGINS = ['http://localhost:4300', 'http://127.0.0.1:4300'];
const CLIENT_DIST = path.join(__dirname, '..', 'dist', 'cash-flow-app', 'browser');

function corsOptions() {
    // CORS_ORIGIN=* opens the API to any site; a comma-separated list restricts it.
    const raw = (process.env.CORS_ORIGIN || '').trim();
    if (raw === '*') return { origin: true };
    const allowed = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
    return {
        origin(origin, callback) {
            // Same-origin / curl requests have no Origin header: allow them.
            if (!origin || allowed.includes(origin)) return callback(null, true);
            callback(new Error(`Origin ${origin} is not allowed by CORS`));
        }
    };
}

function createApp() {
    const app = express();
    app.set('trust proxy', process.env.TRUST_PROXY === '1');

    app.use(cors(corsOptions()));
    app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

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

    // Any change to the data makes the cached AI summary stale.
    app.use('/api', (req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            res.on('finish', () => financialSummary.invalidate());
        }
        next();
    });

    app.use('/api', routes);

    // Production: serve the built Angular client from the same origin (no CORS needed).
    if (fs.existsSync(CLIENT_DIST)) {
        logger.info(`🌐 Serving client from ${CLIENT_DIST}`);
        app.use(express.static(CLIENT_DIST));
        app.get(/^(?!\/api(\/|$)).*/, (req, res, next) => {
            if (req.method !== 'GET' || req.path === '/health') return next();
            res.sendFile(path.join(CLIENT_DIST, 'index.html'));
        });
    }

    // 404 handler
    app.use((req, res) => {
        logger.warn(`Route not found: ${req.method} ${req.path}`);
        res.status(404).json({
            success: false,
            error: { name: 'NotFoundError', message: 'Route not found', path: req.path }
        });
    });

    // Error handling (must be last)
    app.use(errorHandler);
    return app;
}

module.exports = { createApp, CLIENT_DIST };
