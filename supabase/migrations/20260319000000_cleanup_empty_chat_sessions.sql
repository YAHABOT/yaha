-- Migration: cleanup_empty_chat_sessions
-- Purpose: Delete all "New Chat" sessions with zero messages.
-- Root cause: March 2026 builds created sessions on every page load before
-- session creation was gated behind first-message-send. These are orphaned rows.
-- Safe to run: only deletes sessions with title = 'New Chat' AND no messages.

DELETE FROM chat_sessions
WHERE title = 'New Chat'
  AND NOT EXISTS (
    SELECT 1
    FROM chat_messages
    WHERE chat_messages.session_id = chat_sessions.id
  );
