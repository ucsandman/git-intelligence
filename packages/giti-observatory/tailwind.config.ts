import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terrarium: {
          soil: '#1a1410',
          'soil-light': '#2a2218',
          moss: '#2d5a27',
          'moss-light': '#3d7a37',
          amber: '#d4a04a',
          'amber-dim': '#8a6a2a',
          cyan: '#4ad4d4',
          'cyan-dim': '#2a8a8a',
          surface: '#0f0d0a',
          text: '#e8e0d4',
          'text-muted': '#8a8070',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        organic: '1.5rem',
        blob: '40% 60% 55% 45% / 55% 45% 60% 40%',
      },
      animation: {
        breathe: 'breathe 6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '40%': { transform: 'scale(1.15)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
