import '@testing-library/jest-dom'

// Set required env vars for tests — modules with module-level guards need these set before import
process.env.GEMINI_API_KEY = 'test-gemini-key-for-vitest'
