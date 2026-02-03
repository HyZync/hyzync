/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
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
                sans: ['Inter', 'sans-serif'],
            },
            backgroundImage: {
                'gradient-mesh': 'radial-gradient(circle at 15% 50%, rgba(76, 29, 149, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.15), transparent 25%)',
                'primary-gradient': 'linear-gradient(135deg, #c026d3 0%, #7c3aed 100%)',
                'accent-gradient': 'linear-gradient(to right, #c026d3, #7c3aed, #3b82f6, #06b6d4)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 8s infinite alternate',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                }
            }
        },
    },
    plugins: [],
}
