/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Payment status colors
        payment: {
          success: '#10b981',
          error: '#ef4444',
          pending: '#f59e0b',
          processing: '#3b82f6',
          canceled: '#6b7280',
        },
        // Provider colors
        stripe: {
          primary: '#635bff',
          secondary: '#0a2540',
        },
        paypal: {
          primary: '#003087',
          secondary: '#009cde',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
