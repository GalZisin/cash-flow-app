const { sql, C, SEL, exec, rows, withTransaction, insertMany, updateRow, getPool } = require('../db/helpers');
const { conversationToRows, assembleConversations } = require('../db/mappers');
const traceMethods = require('../utils/traceMethods');

const PARENT_COLUMNS = [
    C.id('id'), C.str('title', 500), C.ts('created_at'), C.ts('updated_at'), C.text('extra_json')
];

const MESSAGE_COLUMNS = [
    C.id('conversation_id'), C.int('sort_order'), C.vchar('role', 20), C.text('content'), C.ts('sent_at'),
    C.text('extra_json')
];

const ID_FILTER = '(@id IS NULL OR {col} = @id)';

async function load(executor, id = null) {
    const params = { id: [sql.NVarChar(50), id] };
    const filter = (column) => ID_FILTER.replace('{col}', column);

    const [parents, messages] = await Promise.all([
        rows(executor, `
            SELECT id, title, ${SEL.ts('created_at')}, ${SEL.ts('updated_at')}, extra_json
            FROM dbo.conversations WHERE ${filter('id')} ORDER BY seq`, params),
        rows(executor, `
            SELECT conversation_id, sort_order, role, content, ${SEL.ts('sent_at')}, extra_json
            FROM dbo.conversation_messages WHERE ${filter('conversation_id')}
            ORDER BY conversation_id, sort_order`, params)
    ]);

    return assembleConversations(parents, messages);
}

/**
 * Repository for conversations data access
 */
class ConversationsRepository {
    /**
     * Read all conversations
     * @returns {Promise<Array>}
     */
    async readAll() {
        const pool = await getPool();
        return load(pool);
    }

    /**
     * Replace all conversations
     * @param {Array} conversations
     * @returns {Promise<void>}
     */
    async writeAll(conversations) {
        const all = conversations.map(conversationToRows);
        await withTransaction(async (tx) => {
            await exec(tx, 'DELETE FROM dbo.conversations WITH (TABLOCKX)'); // messages are removed by cascade
            for (const parts of all) {
                await insertMany(tx, 'dbo.conversations', PARENT_COLUMNS, [parts.parent]);
                await insertMany(tx, 'dbo.conversation_messages', MESSAGE_COLUMNS, parts.messages);
            }
        });
    }

    /**
     * Find conversation by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        const pool = await getPool();
        const items = await load(pool, String(id));
        return items[0] || null;
    }

    /**
     * Create new conversation
     * @param {Object} conversation
     * @returns {Promise<Object>}
     */
    async create(conversation) {
        const parts = conversationToRows(conversation);
        await withTransaction(async (tx) => {
            await insertMany(tx, 'dbo.conversations', PARENT_COLUMNS, [parts.parent]);
            await insertMany(tx, 'dbo.conversation_messages', MESSAGE_COLUMNS, parts.messages);
        });
        return conversation;
    }

    /**
     * Update conversation
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const parts = conversationToRows({ ...existing, ...updates, id: existing.id });
        await withTransaction(async (tx) => {
            await updateRow(tx, 'dbo.conversations', PARENT_COLUMNS, parts.parent, 'id');
            await exec(tx, 'DELETE FROM dbo.conversation_messages WHERE conversation_id = @id', {
                id: [sql.NVarChar(50), parts.parent.id]
            });
            await insertMany(tx, 'dbo.conversation_messages', MESSAGE_COLUMNS, parts.messages);
        });

        return this.findById(id);
    }

    /**
     * Delete conversation
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        const pool = await getPool();
        const result = await exec(pool, 'DELETE FROM dbo.conversations WHERE id = @id', {
            id: [sql.NVarChar(50), String(id)]
        });
        return (result.rowsAffected[0] || 0) > 0;
    }
}

module.exports = traceMethods(new ConversationsRepository(), 'conversationsRepository');
