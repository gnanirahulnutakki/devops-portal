import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Radiant Logic Brand Colors
      colors: {
        // Primary brand colors
        'rl-navy': {
          DEFAULT: '#09143F',
          light: '#0d1a4f',
          dark: '#050a24',
          50: '#e6e7ed',
          100: '#c0c3d4',
          200: '#969bb8',
          300: '#6c739c',
          400: '#4d5587',
          500: '#2d3772',
          600: '#28316a',
          700: '#212a5f',
          800: '#1a2355',
          900: '#09143F',
        },
        'rl-orange': {
          DEFAULT: '#e25a1a',
          light: '#ff7a3d',
          dark: '#b8460d',
          50: '#fef3ee',
          100: '#fde3d4',
          200: '#fbc4a9',
          300: '#f89c72',
          400: '#f46839',
          500: '#e25a1a',
          600: '#d34712',
          700: '#af3511',
          800: '#8c2c16',
          900: '#712815',
        },
        'rl-blue': {
          DEFAULT: '#2ea3f2',
          light: '#5db7f5',
          dark: '#1976d2',
          50: '#eff8ff',
          100: '#dbeffe',
          200: '#bfe4fe',
          300: '#93d4fc',
          400: '#5fb9f8',
          500: '#2ea3f2',
          600: '#1a84e3',
          700: '#166cd0',
          800: '#1858a9',
          900: '#194b85',
        },
        'rl-green': {
          DEFAULT: '#00b12b',
          light: '#33c455',
          dark: '#008a21',
          50: '#edfff2',
          100: '#d5ffe3',
          200: '#adffc8',
          300: '#70ffa0',
          400: '#2cfb70',
          500: '#00b12b',
          600: '#00c72d',
          700: '#009c26',
          800: '#067a23',
          900: '#08651f',
        },
        // Semantic colors using brand palette
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['"Open Sans"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
