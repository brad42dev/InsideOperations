/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'http://localhost:3000',
                changeOrigin: true,
            },
            '/ws': {
                target: process.env.VITE_WS_URL || 'ws://localhost:3001',
                ws: true,
            },
        },
    },
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**'],
        env: {
            VITE_API_URL: 'http://localhost:3000',
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        // ECharts alone is ~1 MB unminified (343 kB gzip) — raise the warning
        // threshold to 1.1 MB so the build output is clean.
        chunkSizeWarningLimit: 1100,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
                    'vendor-echarts': ['echarts'],
                    'vendor-uplot': ['uplot'],
                    'vendor-leaflet': ['leaflet'],
                    'vendor-svg': ['@svgdotjs/svg.js'],
                    'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit'],
                    'vendor-radix': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-toast',
                        '@radix-ui/react-tooltip',
                    ],
                },
            },
        },
    },
});
