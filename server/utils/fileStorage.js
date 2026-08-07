const fs = require('fs').promises;
const path = require('path');

class FileStorage {
    /**
     * Read JSON file
     * @param {string} filePath - Path to file
     * @param {any} defaultValue - Default value if file doesn't exist
     * @returns {Promise<any>}
     */
    async readJSON(filePath, defaultValue = null) {
        try {
            const exists = await this.fileExists(filePath);
            if (!exists) {
                console.log(`File not found: ${filePath}, returning default value`);
                return defaultValue;
            }

            const data = await fs.readFile(filePath, { encoding: 'utf8' });
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Write JSON file
     * @param {string} filePath - Path to file
     * @param {any} data - Data to write
     * @returns {Promise<void>}
     */
    async writeJSON(filePath, data) {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(
                filePath,
                JSON.stringify(data, null, 2),
                { encoding: 'utf8' }
            );

            console.log(`File written successfully: ${filePath}`);
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    /**
     * Check if file exists
     * @param {string} filePath
     * @returns {Promise<boolean>}
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete file
     * @param {string} filePath
     * @returns {Promise<void>}
     */
    async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`File deleted: ${filePath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error deleting file ${filePath}:`, error);
                throw new Error(`Failed to delete file: ${error.message}`);
            }
        }
    }
}

module.exports = new FileStorage();
