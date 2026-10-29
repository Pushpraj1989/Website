import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the console talks to the API on port 3100 through the same origin, so the staff cookie works.
const API_PROXY = {
  '/v1': 'http://localhost:3100',
  '/media': 'http://localhost:3100',
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: API_PROXY },
  preview: { proxy: API_PROXY },
});
