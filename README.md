# Backend (NestJS + Prisma)

CRUD API for owners, pets, care plans, and notifications. PostgreSQL runs in Docker with a named volume.

Authenticated as the **vet** (Firebase User). Pet **tutors** are `Owner` rows scoped to that vet.

## Run

```bash
cd backend
cp .env.example .env
docker compose up -d
npx prisma migrate deploy --config prisma7.config.ts
npx prisma db seed --config prisma7.config.ts
npm run start:dev
```

API: `http://localhost:3003`

Send `Authorization: Bearer <Firebase ID token>` on every request except `GET /`.

For local curl without Firebase, keep `AUTH_DEV_BYPASS=true` (default in `.env.example`). Requests without a token run as `AUTH_DEV_USER_ID` / `SEED_USER_ID` (`seed-vet-demo`). To see seed tutors in the app, set `SEED_USER_ID` to your Firebase uid and re-seed.

- `GET /notifications?page=1`
- `GET /owner` (list with pets, current vet only)
- `GET /owner?document=`
- `GET /owner/:id`
- `GET /owner/:petId/plan`
- `POST /owner`
- `POST /owner/:id/pet`
- `POST /owner/:petId/plan`

`docker compose down` keeps data. `docker compose down -v` wipes the volume.
