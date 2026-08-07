/**
 * Logger utility
 * Logs to both console and files in logs/ directory
 * Files: error.log, combined.log
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

class Logger {
    constructor() {
        this.level = process.env.LOG_LEVEL || 'INFO';
        this.logsDir = path.join(__dirname, '../logs');
        this.errorLogFile = path.join(this.logsDir, 'error.log');
        this.combinedLogFile = path.join(this.logsDir, 'combined.log');

        // Create logs directory if it doesn't exist
        this._ensureLogsDirectory();
    }

    _ensureLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    _shouldLog(level) {
        const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
        return levels.indexOf(level) <= levels.indexOf(this.level);
    }

    _format(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}`;
    }

    _writeToFile(filePath, message) {
        try {
            fs.appendFileSync(filePath, message + '\n', 'utf8');
        } catch (err) {
            // Fallback to console only if file write fails
            console.error('Failed to write to log file:', err.message);
        }
    }

    error(message, meta = {}) {
        if (this._shouldLog(LOG_LEVELS.ERROR)) {
            const formatted = this._format(LOG_LEVELS.ERROR, message, meta);
            console.error(formatted);
            this._writeToFile(this.errorLogFile, formatted);
            this._writeToFile(this.combinedLogFile, formatted);
        }
    }

    warn(message, meta = {}) {
        if (this._shouldLog(LOG_LEVELS.WARN)) {
            const formatted = this._format(LOG_LEVELS.WARN, message, meta);
            console.warn(formatted);
            this._writeToFile(this.combinedLogFile, formatted);
        }
    }

    info(message, meta = {}) {
        if (this._shouldLog(LOG_LEVELS.INFO)) {
            const formatted = this._format(LOG_LEVELS.INFO, message, meta);
            console.info(formatted);
            this._writeToFile(this.combinedLogFile, formatted);
        }
    }

    debug(message, meta = {}) {
        if (this._shouldLog(LOG_LEVELS.DEBUG)) {
            const formatted = this._format(LOG_LEVELS.DEBUG, message, meta);
            console.log(formatted);
            this._writeToFile(this.combinedLogFile, formatted);
        }
    }
}

module.exports = new Logger();
