const fileStorage = require('../utils/fileStorage');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/conversations.json');

/**
 * Repository for conversations data access
 */
class ConversationsRepository {
    /**
     * Read all conversations
     * @returns {Promise<Array>}
     */
    async readAll() {
        return await fileStorage.readJSON(DATA_FILE, []);
    }

    /**
     * Write all conversations
     * @param {Array} conversations
     * @returns {Promise<void>}
     */
    async writeAll(conversations) {
        return await fileStorage.writeJSON(DATA_FILE, conversations);
    }

    /**
     * Find conversation by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const conversations = await this.readAll();
        return conversations.find(c => c.id === id) || null;
    }

    /**
     * Create new conversation
     * @param {Object} conversation
     * @returns {Promise<Object>}
     */
    async create(conversation) {
        const conversations = await this.readAll();
        conversations.push(conversation);
        await this.writeAll(conversations);
        return conversation;
    }

    /**
     * Update conversation
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const conversations = await this.readAll();
        const index = conversations.findIndex(c => c.id === id);

        if (index === -1) {
            return null;
        }

        conversations[index] = { ...conversations[index], ...updates };
        await this.writeAll(conversations);
        return conversations[index];
    }

    /**
     * Delete conversation
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const conversations = await this.readAll();
        const filtered = conversations.filter(c => c.id !== id);

        if (filtered.length === conversations.length) {
            return false; // Not found
        }

        await this.writeAll(filtered);
        return true;
    }
}

module.exports = new ConversationsRepository();
