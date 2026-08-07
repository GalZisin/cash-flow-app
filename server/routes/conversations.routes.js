const express = require('express');
const router = express.Router();
const conversationsService = require('../services/conversations.service');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/conversations
 * Get all conversations
 */
router.get('/', asyncHandler(async (req, res) => {
    const conversations = await conversationsService.getAllConversations();
    res.json(conversations);
}));

/**
 * POST /api/conversations
 * Create new conversation
 */
router.post('/', asyncHandler(async (req, res) => {
    // Generate ID using timestamp for compatibility
    const conversation = {
        title: req.body.title || 'שיחה חדשה',
        messages: req.body.messages || []
    };

    const created = await conversationsService.createConversation(conversation);

    // Override UUID with timestamp-based ID for compatibility
    created.id = Date.now().toString();

    res.json(created);
}));

/**
 * PUT /api/conversations/:id
 * Update conversation (messages + title)
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const updates = {};

    if (req.body.title !== undefined) {
        updates.title = req.body.title;
    }

    if (req.body.messages !== undefined) {
        updates.messages = req.body.messages;
    }

    const updated = await conversationsService.updateConversation(req.params.id, updates);
    res.json(updated);
}));

/**
 * DELETE /api/conversations/:id
 * Delete conversation
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    await conversationsService.deleteConversation(req.params.id);
    res.json({ success: true });
}));

module.exports = router;
