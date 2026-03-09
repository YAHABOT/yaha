import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        surface: '#0A0A0A',
        surfaceHighlight: '#121212',
        border: '#1E1E1E',
        textPrimary: '#F5F5F5',
        textMuted: '#6B7280',
        nutrition: '#10b981',
        sleep: '#3b82f6',
        workout: '#f97316',
        mood: '#a855f7',
        water: '#06b6d4',
      },
    },
  },
  plugins: [],
}

export default config
