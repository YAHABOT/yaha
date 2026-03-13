import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Main content area — light theme
        background: '#F5F5F5',
        surface: '#FFFFFF',
        surfaceHighlight: '#F0F0F0',
        border: '#E5E7EB',
        textPrimary: '#0A0A0A',
        textMuted: '#6B7280',
        // Primary accent — lime green
        primary: {
          DEFAULT: '#C4E400',
          hover: '#B0D700',
          foreground: '#0A0A0A',
        },
        // Sidebar — stays dark
        sidebar: {
          DEFAULT: '#0A0A0A',
          border: '#1E1E1E',
          text: '#F5F5F5',
          muted: '#9CA3AF',
        },
        // Tracker-category colors
        nutrition: '#10b981',
        sleep: '#3b82f6',
        workout: '#f97316',
        mood: '#a855f7',
        water: '#06b6d4',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
