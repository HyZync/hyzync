/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
        // Safelist sidebar dynamic color classes used in HorizonStandalone.jsx
        {
            pattern: /^(bg|text|border)-(indigo|violet|emerald|sky|slate|amber|rose|cyan)-(50|100|200|300|400|500|600|700|800|900)$/,
        },
        {
            pattern: /^shadow-(indigo|violet|emerald|sky|slate|amber|rose|cyan)-(100|200|300|600)\/\d+$/,
        },
    ],
    theme: {
        extend: {
            colors: {
                background: '#0a0a0f',
                white: '#ffffff',
                'white-10': 'rgba(255, 255, 255, 0.1)',
                'white-5': 'rgba(255, 255, 255, 0.05)',
                secondary: '#94a3b8',
                card: 'rgba(255, 255, 255, 0.03)',
                'card-hover': 'rgba(255, 255, 255, 0.07)',
                brand: {
                    purple: '#c026d3',
                    cyan: '#06b6d4',
                    magenta: '#db2777',
                    green: '#10b981',
                    orange: '#f59e0b',
                    blue: '#3b82f6',
                }
            },
            fontFamily: {
                sans: ['Sora', 'system-ui', '-apple-system', 'sans-serif'],
            },
            backgroundImage: {
                'gradient-mesh': 'radial-gradient(circle at 15% 50%, rgba(76, 29, 149, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.15), transparent 25%)',
                'primary-gradient': 'linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)',
                'accent-gradient': 'linear-gradient(to right, #c026d3, #7c3aed, #3b82f6, #06b6d4)',
            },
            boxShadow: {
                'card-hover': '0 8px 30px -12px rgba(0, 0, 0, 0.12)',
                'float': '0 20px 60px -15px rgba(0, 0, 0, 0.1)',
                'inner-ring': 'inset 0 0 0 1px rgba(99, 102, 241, 0.1)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 8s infinite alternate',
                'shimmer': 'shimmer 1.5s infinite',
                'slide-up': 'slide-up 0.4s ease-out',
                'fade-in': 'fade-in 0.3s ease-out',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
            }
        },
    },
    plugins: [],
}
