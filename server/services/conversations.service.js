const conversationsRepository = require('../repositories/conversations.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Service for conversations business logic
 */
class ConversationsService {
    /**
     * Get all conversations
     * @returns {Promise<Array>}
     */
    async getAllConversations() {
        return await conversationsRepository.readAll();
    }

    /**
     * Get conversation by ID
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async getConversationById(id) {
        const conversation = await conversationsRepository.findById(id);

        if (!conversation) {
            throw new NotFoundError(`Conversation with id ${id} not found`);
        }

        return conversation;
    }

    /**
     * Create new conversation
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createConversation(data) {
        // Validate required fields
        if (!data.title) {
            throw new ValidationError('Title is required');
        }

        const conversation = {
            id: Date.now().toString(),
            title: data.title,
            messages: data.messages || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return await conversationsRepository.create(conversation);
    }

    /**
     * Update conversation
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateConversation(id, updates) {
        const updated = await conversationsRepository.update(id, {
            ...updates,
            updatedAt: new Date().toISOString()
        });

        if (!updated) {
            throw new NotFoundError(`Conversation with id ${id} not found`);
        }

        return updated;
    }

    /**
     * Delete conversation
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteConversation(id) {
        const deleted = await conversationsRepository.delete(id);

        if (!deleted) {
            throw new NotFoundError(`Conversation with id ${id} not found`);
        }
    }

    /**
     * Add message to conversation
     * @param {string} conversationId
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async addMessage(conversationId, message) {
        const conversation = await this.getConversationById(conversationId);

        if (!message.content) {
            throw new ValidationError('Message content is required');
        }

        const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            role: message.role || 'user',
            content: message.content,
            timestamp: new Date().toISOString()
        };

        conversation.messages.push(newMessage);

        return await this.updateConversation(conversationId, {
            messages: conversation.messages
        });
    }
}

module.exports = new ConversationsService();
