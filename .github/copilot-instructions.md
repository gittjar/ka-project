# Copilot Instructions

- Vue 3 SPA (`frontend/`) + Node.js/Express REST API (`backend/`)
- Frontend: Vue 3 `<script setup>`, Pinia stores, Vue Router 4, Tailwind CSS v4
- Backend: ES modules (`import/export`), Mongoose, JWT auth, Azure Blob for image uploads
- API base URL proxied via Vite: `/api` → `http://localhost:3001/api`
- Auth token stored in `localStorage` as `kk_token`, accessed via `useAuthStore()`
- Admin routes protected by `authMiddleware` + role check (`req.role !== 'admin'`)
- Image uploads go to Azure Blob containers: `gallery` or `avatars`
