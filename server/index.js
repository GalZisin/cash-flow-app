const { createApp } = require('./app');
const logger = require('./utils/logger');
const { getPool, closePool } = require('./db/connection');
const aiService = require('./services/ai.service');

const PORT = process.env.PORT || 3000;
const app = createApp();

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
        const ai = aiService.describe();
        logger.info(`AI: ${ai.provider} ${ai.baseUrl} (model ${ai.model})`);
        if (ai.missingApiKey) {
            logger.warn('AI_API_KEY is not set in server/.env - the AI tab will not work. Free Groq key: https://console.groq.com/keys (see docs/ai/AI_PROVIDERS.md)');
        }
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
