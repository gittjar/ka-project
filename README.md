# Kanniaalio+ Vue

Kanniaalio+ on vuodesta 2003 toimineen yhteisön päivitetty verkkosivusto. Alkuperäinen tripod-sivu on modernisoitu Vue 3 + Node.js -stackilla.

## Stack

| Frontend | Backend | DB / Media |
|---|---|---|
| Vue 3 + Vite + TypeScript | Node.js + Express 5 | MongoDB Atlas |
| Vue Router 4 + Pinia | Mongoose + JWT | Azure Blob Storage |
| Tailwind CSS v4 | bcryptjs + multer | |

## Rakenne

```
kanniaalio-vue/
  frontend/   ← Vue 3 SPA
  backend/    ← Express REST API
```

## Käynnistys

```bash
# Backend
cp backend/.env.example backend/.env   # täytä muuttujat
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:3001
