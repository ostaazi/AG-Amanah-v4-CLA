/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            animation: {
                'shield-breathing': 'shieldBreathing 4s ease-in-out infinite',
            },
            keyframes: {
                shieldBreathing: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '1' },
                    '50%': { transform: 'scale(1.03)', opacity: '0.92' },
                },
            },
        },
    },
    plugins: [],
}
