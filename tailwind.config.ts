import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'rgb(var(--bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
          panel: 'rgb(var(--bg-panel) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)'
        },
        fg: {
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)'
        },
        state: {
          success: 'rgb(var(--state-success) / <alpha-value>)',
          warning: 'rgb(var(--state-warning) / <alpha-value>)',
          error: 'rgb(var(--state-error) / <alpha-value>)',
          info: 'rgb(var(--state-info) / <alpha-value>)'
        },
        diff: {
          addBg: 'rgb(var(--diff-add-bg) / <alpha-value>)',
          delBg: 'rgb(var(--diff-del-bg) / <alpha-value>)'
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          '"Cascadia Mono"',
          'monospace'
        ]
      },
      borderRadius: {
        panel: '10px',
        card: '8px',
        chip: '999px'
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--border) / 0.4)',
        modal: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgb(var(--border) / 0.6)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        fadeIn: 'fadeIn 0.2s ease-out',
        scaleIn: 'scaleIn 0.22s ease-out'
      }
    }
  },
  plugins: []
} satisfies Config
