
## Stack

| Frontend | Backend | DB / Media |
|---|---|---|
| Vue 3 + Vite + TypeScript | Node.js + Express 5 | MongoDB Atlas |
| Vue Router 4 + Pinia | Mongoose + JWT | Azure Blob Storage |
| Tailwind CSS v4 | bcryptjs + multer | |

## Google APIs

| API | Avain (.env) | Käyttö |
|---|---|---|
| [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) | `GOOGLEMAP_API_KEY` | Kartan renderöinti frontendissa (`DrinksView`) |
| [Places API (New)](https://developers.google.com/maps/documentation/places/web-service) | `PLACES_API_KEY` | Lähipaikkojen haku (`/api/places/nearby`) — 5 rinnakkaista batchia: baarit, alko, kaupat, ruoka, panimot |
| [Place Photos API](https://developers.google.com/maps/documentation/places/web-service/place-photos) | `PLACES_API_KEY` | Paikkojen valokuvat proxyn kautta (`/api/places/photo`) |

> **Huom:** `GOOGLEMAP_API_KEY` rajoita Maps JavaScript API:hin (HTTP Referer). `PLACES_API_KEY` rajoita Places API (New) + Photos -käyttöön (IP tai palvelinpuoli). Rate limit: 100 req / IP / 24h (`express-rate-limit`).

## Rakenne

```
project-root/
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
