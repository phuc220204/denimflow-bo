/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F6F7F9',
        surface: '#FFFFFF',
        border: '#E2E5EA',
        text: {
          DEFAULT: '#1F2933',
          muted: '#5B6672',
        },
        primary: {
          DEFAULT: '#2F5D8A',
          hover: '#254A70',
          tint: '#E8EFF6',
        },
        success: {
          DEFAULT: '#2E7D5B',
          text: '#24694A',
          tint: '#E6F2EC',
        },
        warning: {
          DEFAULT: '#B7791F',
          text: '#8A5A0B',
          tint: '#FBF3E0',
        },
        danger: {
          DEFAULT: '#B33A3A',
          text: '#8F2D2D',
          tint: '#F8E8E8',
        },
        neutral: {
          tint: '#EEF0F3',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        badge: '4px',
      },
    },
  },
  plugins: [],
};
