/**
 * Unified Design Tokens and Theme System
 * Beige & Maroon theme for professional testing platform
 */

// Beige & Maroon Color Palette
const beige = {
  50: '#faf9f7',
  100: '#f5f3f0',
  200: '#ebe8e3',
  300: '#ddd8d0',
  400: '#c9c2b8',
  500: '#b5ab9f',
  600: '#9d9183',
  700: '#7a6f63',
  800: '#5d544a',
  900: '#3d3630',
}

const maroon = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#5c0f0f',
}

export const theme = {
  // Background colors - beige palette
  bg: {
    primary: beige[50],      // Main background
    secondary: '#ffffff',   // Panels and cards
    tertiary: beige[100],   // Elevated surfaces (buttons, inputs)
    overlay: 'rgba(61, 54, 48, 0.5)',
    overlayLight: 'rgba(61, 54, 48, 0.3)',
  },

  // Text colors
  text: {
    primary: beige[900],    // Main text
    secondary: beige[700],  // Secondary text
    tertiary: beige[600],   // Muted text
    inverse: '#ffffff',     // Text on dark backgrounds
  },

  // Border colors
  border: {
    default: beige[300],
    subtle: beige[200],
    emphasis: beige[400],
  },

  // Accent colors - maroon as primary, with complementary colors
  accent: {
    primary: maroon[800],
    primaryLight: maroon[700],
    primaryDark: maroon[900],
    blue: '#3b82f6',
    blueSubtle: 'rgba(59, 130, 246, 0.1)',
    green: '#10b981',
    greenSubtle: 'rgba(16, 185, 129, 0.1)',
    red: maroon[600],
    redSubtle: maroon[100],
    yellow: '#f59e0b',
    yellowSubtle: 'rgba(245, 158, 11, 0.1)',
    purple: '#9333ea',
    purpleSubtle: 'rgba(147, 51, 234, 0.1)',
    orange: '#f97316',
    orangeSubtle: 'rgba(249, 115, 22, 0.1)',
  },

  // Spacing scale
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },

  // Border radius
  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },

  // Shadows (adapted for light theme)
  shadows: {
    sm: '0 1px 2px 0 rgba(61, 54, 48, 0.05)',
    md: '0 4px 6px -1px rgba(61, 54, 48, 0.1), 0 2px 4px -1px rgba(61, 54, 48, 0.06)',
    lg: '0 10px 15px -3px rgba(61, 54, 48, 0.1), 0 4px 6px -2px rgba(61, 54, 48, 0.05)',
    xl: '0 20px 25px -5px rgba(61, 54, 48, 0.1), 0 10px 10px -5px rgba(61, 54, 48, 0.04)',
    glow: '0 0 20px rgba(153, 27, 27, 0.2)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  },

  // Status colors
  status: {
    success: {
      bg: '#dcfce7',
      border: '#10b981',
      text: '#166534',
    },
    error: {
      bg: maroon[100],
      border: maroon[600],
      text: maroon[800],
    },
    warning: {
      bg: '#fef3c7',
      border: '#f59e0b',
      text: '#92400e',
    },
    info: {
      bg: '#dbeafe',
      border: '#3b82f6',
      text: '#1e40af',
    },
    paused: {
      bg: '#ffedd5',
      border: '#f97316',
      text: '#9a3412',
    },
  },

  // Legacy support for components using theme.colors.dark
  colors: {
    dark: {
      bg: {
        primary: beige[50],
        secondary: '#ffffff',
        tertiary: beige[100],
      },
      text: {
        primary: beige[900],
        secondary: beige[700],
      },
      border: {
        default: beige[300],
      },
      accent: {
        blue: '#3b82f6',
        red: maroon[600],
      },
    },
  },
}

// Theme type
export type Theme = typeof theme

