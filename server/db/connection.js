/**
 * SQL Server connection (single shared pool).
 *
 * Configuration comes from server/.env:
 *   DB_CONNECTION_STRING=Server=localhost,1433;Database=CashFlowDB;User Id=cashflow_app;Password=...;Encrypt=true;TrustServerCertificate=true
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const logger = require('../utils/logger');

const DB_NAME = 'CashFlowDB';

let poolPromise = null;

function loadDriver(connectionString) {
    // Windows Authentication / ODBC style strings need the optional msnodesqlv8 driver.
    if (/trusted_connection|integrated security|driver\s*=/i.test(connectionString)) {
        try {
            return require('mssql/msnodesqlv8');
        } catch (err) {
            throw new Error(
                'This connection string needs the msnodesqlv8 driver. Run: npm install msnodesqlv8 ' +
                `(${err.message})`
            );
        }
    }
    return require('mssql');
}

async function getPool() {
    if (!poolPromise) {
        const connectionString = process.env.DB_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error(
                'DB_CONNECTION_STRING is not set. Copy server/.env.example to server/.env and fill it in.'
            );
        }

        const driver = loadDriver(connectionString);
        const pool = new driver.ConnectionPool(connectionString);
        pool.on('error', (err) => logger.error(`SQL pool error: ${err.message}`));

        poolPromise = pool.connect().then((connected) => {
            logger.info(`🗄️  Connected to SQL Server (database: ${connected.config.database || DB_NAME})`);
            return connected;
        }).catch((err) => {
            poolPromise = null; // allow a retry on the next call
            throw err;
        });
    }
    return poolPromise;
}

async function closePool() {
    if (!poolPromise) return;
    const pool = await poolPromise.catch(() => null);
    poolPromise = null;
    if (pool) await pool.close();
}

module.exports = { getPool, closePool, DB_NAME };
