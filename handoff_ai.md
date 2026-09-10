# AI Build Spec: Veterinary SaaS Backend (Java + Quarkus)

You are rebuilding an existing NestJS + Prisma veterinary SaaS BFF in **Java + Quarkus**.  
Treat this file as the **implementation contract**. Prefer matching the current HTTP JSON API exactly so the existing mobile/web client keeps working.

Companion human doc: `handoff.md` (diagrams and narrative). This file is imperative and checklist-oriented.

---

## 0. Mission

Build a Quarkus REST API on PostgreSQL that:

1. Authenticates vets via Firebase ID tokens.
2. Upserts a `User` row keyed by Firebase `uid`.
3. Scopes all tenant data by that `userId`.
4. Implements owners, pets, care plans → appointments, notifications feed, consultas, products, and dashboard metrics.
5. Ships migrations + a destructive seed keyed by `SEED_USER_ID`.

Do **not** invent alternate route names or rename JSON fields unless unavoidable. When unsure, mirror Nest behavior in `src/**`.

---

## 1. Hard constraints

- Language: Java 21+ (or LTS supported by current Quarkus).
- Framework: Quarkus.
- DB: PostgreSQL.
- Migrations: Flyway or Liquibase (required).
- JSON: camelCase field names matching sections below.
- Auth: `Authorization: Bearer <Firebase JWT>`; verify against project id from config.
- Timezone for scheduling/dashboard day buckets: `America/Sao_Paulo`.
- `User.id` is a **string** (Firebase uid), not UUID.
- All other entity PKs are UUID.
- `Owner.document` is **globally unique** and stored as digits-only.
- `Product` is **not** tenant-scoped.
- Do not enable auth bypass in production profiles.

---

## 2. Database schema (create exactly)

### Enums

```text
PetSex: M | F
PlanRecurrency: single | recurrent
SaaSPlan: starter | growth | scale
```

### Tables and columns

**user**

| column | type | constraints |
|--------|------|-------------|
| id | varchar PK | Firebase uid |
| user_name | varchar NOT NULL | map JSON `userName` |
| user_email | varchar NOT NULL | map JSON `userEmail` |
| saas_plan | SaaSPlan NOT NULL DEFAULT starter | |
| saas_tutor_quota | int NOT NULL DEFAULT 100 | |
| saas_monthly_fee | int NULL | |

**owner**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK DEFAULT gen_random_uuid() | |
| name, email, telephone | varchar NOT NULL | |
| document | varchar NOT NULL UNIQUE | digits only |
| user_id | varchar NOT NULL FK → user(id) ON DELETE CASCADE | |

**pet**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| name, breed | varchar NOT NULL | |
| sex | PetSex NOT NULL | |
| weight | double precision NOT NULL | |
| age | int NOT NULL | |
| is_castrated | boolean NOT NULL | |
| species | varchar NOT NULL DEFAULT '' | |
| owner_id | uuid NOT NULL FK → owner(id) ON DELETE CASCADE | |

**care_plan**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| description | varchar NOT NULL | |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| pet_id | uuid NOT NULL FK → pet(id) ON DELETE CASCADE | |

**care_plan_item**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| plan_item_name | varchar NOT NULL | |
| plan_recurrency | PlanRecurrency NOT NULL | |
| plan_recurrency_rate | int NULL | |
| plan_duration_in_months | int NOT NULL | |
| notify_whatsapp | boolean NOT NULL | |
| notify_web | boolean NOT NULL | |
| care_plan_id | uuid NOT NULL FK → care_plan(id) ON DELETE CASCADE | |

**product**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| product_name | varchar NOT NULL | |
| product_price | int NOT NULL | |
| product_quantity | int NULL | |

**notification** (appointments)

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| pet_id | uuid NOT NULL FK → pet ON DELETE CASCADE | |
| appointment_date_time | timestamptz NOT NULL | |
| appointment_name | varchar NOT NULL | |
| appointment_price | int NULL | |
| notify_whatsapp | boolean NOT NULL DEFAULT false | |
| notify_web | boolean NOT NULL DEFAULT true | |
| from_care_plan | boolean NOT NULL DEFAULT true | |
| user_id | varchar NOT NULL FK → user ON DELETE CASCADE | |
| product_id | uuid NULL FK → product ON DELETE SET NULL | |

**consulta**

| column | type | constraints |
|--------|------|-------------|
| id | uuid PK | |
| pet_id | uuid NOT NULL FK → pet ON DELETE CASCADE | |
| resumo | text NOT NULL DEFAULT '' | |
| diagnostico | text NOT NULL DEFAULT '' | |
| prescription | text[] NOT NULL DEFAULT '{}' | |
| exams | jsonb NOT NULL DEFAULT '[]' | array of `{name,date}` |
| finalized_at | timestamptz NULL | |
| ai_fed_at | timestamptz NULL | |
| ai_feed_error | text NULL | |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL | |

### Relationship rules you must enforce in ORM/SQL

```
User 1—* Owner
Owner 1—* Pet
Pet 1—* CarePlan
CarePlan 1—* CarePlanItem
Pet 1—* Notification
User 1—* Notification
Pet 1—* Consulta
Product 0—* Notification
```

---

## 3. Config / env

Implement these config keys (env-friendly):

```properties
quarkus.http.port=${PORT:3003}
quarkus.datasource.jdbc.url=${DATABASE_URL}
# Firebase
app.firebase.project-id=${FIREBASE_PROJECT_ID}
app.firebase.service-account-json=${FIREBASE_SERVICE_ACCOUNT:}
app.auth.dev-bypass=${AUTH_DEV_BYPASS:false}
app.auth.dev-user-id=${AUTH_DEV_USER_ID:}
app.seed.user-id=${SEED_USER_ID:seed-vet-demo}
app.auth.debug=${AUTH_DEBUG:false}
```

Auth rules:

1. If Bearer token present → verify Firebase JWT (`aud` / project must match `FIREBASE_PROJECT_ID`).
2. On success → upsert `User` by uid; update name/email; on create set saas defaults.
3. If no token and `AUTH_DEV_BYPASS=true` → act as `AUTH_DEV_USER_ID` or `SEED_USER_ID` or `seed-vet-demo`.
4. Else 401.
5. Wrong project id must fail verification (401).

Inject authenticated user id into request context; every tenant query must filter by it.

---

## 4. REST endpoints (implement all)

Global: CORS enabled. No `/api` prefix unless you also update clients (default: **no prefix**).

### Public

- `GET /` → plain text or JSON string `Hello World!`

### Me

- `GET /me` → `{ id, userName, userEmail, saasPlan, saasTutorQuota, saasMonthlyFee }`

### Owner module

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/owner` | List owners for vet with pets. Optional `?document=` returns single owner match (no pets list required if current API omits them). |
| GET | `/owner/{id}` | Owner + pets; 404 if not owned |
| POST | `/owner` | Body below; create owner + pets (≥1); 409 if document exists |
| POST | `/owner/{id}/pet` | Add pet to owned owner |
| GET | `/owner/{petId}/plan` | Plan view response |
| POST | `/owner/{petId}/plan` | Replace plan + regenerate appointments |
| PATCH | `/owner/{petId}/plan` | Update appointment notify flags |
| POST | `/owner/{petId}/plan/appointments` | Manual appointment; HTTP 201 |
| DELETE | `/owner/{petId}/plan/appointments/{appointmentId}` | Delete appointment |

**POST /owner body**

```json
{
  "owner": { "name": "string", "email": "string", "telephone": "string", "document": "string" },
  "pet": [
    {
      "name": "string",
      "breed": "string",
      "sex": "M",
      "weight": 1.0,
      "age": 1,
      "isCastrated": false,
      "species": "string"
    }
  ]
}
```

Normalize `document` to digits only before save/lookup.

**POST /owner/{petId}/plan body**

```json
{
  "carePlanDescription": "string",
  "carePlan": [
    {
      "planItemName": "string",
      "planRecurrency": "single",
      "planRecurrencyRate": 3,
      "planDurationInMonths": 12,
      "notifyWhatsapp": false,
      "notifyWeb": true
    }
  ]
}
```

**Plan response (GET and mutating plan endpoints)**

```json
{
  "carePlanDescription": "string",
  "carePlan": [
    {
      "id": "uuid",
      "appointmentName": "string",
      "appointmentPrice": 0,
      "appointmentDate": "ISO-8601",
      "ownerContact": "string",
      "notifyWhatsapp": false,
      "notifyWeb": true
    }
  ]
}
```

Note: response field `carePlan` is the **list of Notification appointments**, not `CarePlanItem` rows.

**POST appointment body**

```json
{
  "productId": "uuid",
  "appointmentDate": "ISO-8601",
  "notifyWhatsapp": false,
  "notifyWeb": true
}
```

### Notifications

- `GET /notifications` — vet-scoped, `notifyWeb = true` only.
- `GET /notifications/{ownerId}` — same + owner filter.
- Support query params `page`, `dateFrom`, `dateTo` if present in current Nest schemas.

Item shape:

```json
{
  "id": "uuid",
  "petName": "",
  "petRace": "",
  "ownerName": "",
  "ownerId": "",
  "petId": "",
  "ownerContact": "",
  "appointmentName": "",
  "appointmentPrice": 0,
  "appointmentDate": "ISO-8601",
  "plan": { "date": "ISO-8601", "procedure": "" }
}
```

### Consulta

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/consulta` | `{ "petId" }` create empty consulta for owned pet |
| GET | `/consulta?petId=` | latest by `createdAt` desc; **404** `Consulta not found` if none |
| GET | `/consulta/{id}` | by id + ownership |
| PATCH | `/consulta/{id}` | partial update |

PATCH optional fields: `resumo`, `diagnostico`, `prescription` (string[]), `exams` (`{name,date}[]`), `finalizedAt`, `aiFedAt`, `aiFeedError` (nullable ISO dates). If `aiFedAt` set, clear `aiFeedError`.

Include nested `pet` + `owner` on consulta responses (match Nest select).

### Dashboard

- `GET /dashboard` → compute metrics from notifications in roughly `[now-370d, now+40d]`.
- Resolve prices via product name lookup when stored price/product missing.
- Return structure with at least:
  - `ticketMedio` `{ value, changePct }`
  - `ltvMedio` `{ value, changePct }`
  - `paybackMeses` `{ value, change }`
  - `pacientesUnicos` (count + per-weekday breakdown)
  - `receitaRecuperada`
  - `rentabilidade`

Port logic from `src/dashboard/dashboard.metrics.ts` and `src/common/saas-plan.ts` closely. SaaS fee bands:

- starter: fee 249–349 for quota 0–300
- growth: 599–899 for 300–1500
- scale: 1500–3000 for 1501+
- interpolate within band; `saasMonthlyFee` overrides.

### Products

- `GET /products?q=` — global list; optional case-insensitive name contains; order by name.
- Response items: `{ id, productName, productPrice, productQuantity }`.

---

## 5. Domain algorithms (must port)

### 5.1 Product lookup

Normalize names: Unicode NFD → strip combining marks → lowercase → trim.  
Match appointment/plan item names to `Product.productName` using that key.

### 5.2 Schedule builder (care plan → notifications)

Port `src/common/schedule.ts`:

1. Use America/Sao_Paulo calendar dates.
2. If generated day is Sunday, move to Monday (+1 day).
3. `single`: one appointment at plan creation time horizon.
4. `recurrent`: emit occurrences every `planRecurrencyRate` months while within `planDurationInMonths`.
5. Copy notify flags from item.
6. Set `fromCarePlan=true`, `userId=vet`, link `productId` when matched, set `appointmentPrice` from product when available.

### 5.3 Replace care plan

In one transaction:

1. Assert pet owned by vet.
2. Delete notifications for pet where `fromCarePlan=true`.
3. Delete existing care plans for pet (items cascade).
4. Insert new care plan + items.
5. Insert generated notifications.

### 5.4 Manual appointment

1. Require existing care plan for pet.
2. Load product by id; 404 if missing.
3. Create notification with `fromCarePlan=false`, name/price from product.

### 5.5 Ownership helpers

Always verify:

- Owner.userId == currentUserId
- Pet via owner.userId
- Notification.userId == currentUserId
- Consulta via pet.owner.userId

Return 404 (not 403) for cross-tenant misses, matching current API.

---

## 6. Seed command

Implement a runnable seed (Quarkus CLI command, `@QuarkusMain`, or Maven exec) that:

1. Deletes in safe order: notifications → care_plan_items → care_plans → pets → owners → users → products (or TRUNCATE CASCADE).
2. Inserts ~15 products (use names/prices from `prisma/seed.ts`).
3. Creates one user with `id = SEED_USER_ID`.
4. Creates demo owners/pets matching seed (Ana/Thor, Carlos/Mel, Mariana/Nina+Bob, Pedro/Rex).
5. Creates Thor + Mel care plans and generated appointments.
6. Inserts synthetic historical notifications for dashboard (~6 months + last 7 days).

Document how to run:

```bash
SEED_USER_ID=<firebase-uid> ./mvnw quarkus:run -Dquarkus.args=seed
# or equivalent
```

---

## 7. Project structure (suggested)

```text
src/main/java/.../
  Application / Main
  config/FirebaseConfig, AuthConfig
  security/FirebaseAuthFilter or SecurityIdentity augmentor
  domain/ entities
  repository/ or Panache entities
  service/ OwnerService, PlanService, ScheduleService, ConsultaService, NotificationService, DashboardService, ProductService, AuthService
  resource/ REST resources matching paths above
  dto/ request/response records
  util/ DocumentNormalizer, ProductLookup, SaoPauloTime, SaasPlanFees
src/main/resources/
  application.properties
  db/migration/ V1__init.sql ...
src/test/java/ ... REST + auth + schedule unit tests
```

---

## 8. Implementation order (follow this)

1. Quarkus app skeleton + Postgres + Flyway schema matching §2.
2. Firebase auth filter + `/me` + user upsert.
3. Products CRUD-read + seed products.
4. Owner + pet endpoints.
5. Schedule utility + care plan replace + plan GET.
6. Manual appointments + notify PATCH/DELETE.
7. Notifications list endpoints.
8. Consulta endpoints.
9. Dashboard metrics.
10. Full seed + README for Quarkus.
11. Contract tests against example curls from `handoff.md`.

---

## 9. Testing requirements

Add automated tests for:

- [ ] Unauthenticated protected route → 401
- [ ] Document digits normalization + unique conflict
- [ ] Care plan regenerate deletes old `fromCarePlan` notifications
- [ ] Sunday nudge in scheduler
- [ ] Product name accent-insensitive match
- [ ] Consulta GET latest 404 then POST then GET 200
- [ ] Dashboard returns required keys for a seeded fixture
- [ ] Tenant isolation: user A cannot read user B owner/pet/consulta

---

## 10. Definition of done

The Quarkus service is done when:

1. Schema matches §2 including cascades.
2. All routes in §4 exist with compatible JSON.
3. Auth + tenancy behave as §3.
4. Care-plan scheduling and product lookup match §5.
5. Seed recreates demo data under configurable `SEED_USER_ID`.
6. README documents run, migrate, seed, and required env vars.
7. A client that worked against the Nest API can point at Quarkus with only base URL change (same Firebase project).

---

## 11. Reference sources in this repo

When behavior is ambiguous, read these Nest files and port faithfully:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/auth/*`
- `src/owner/owner.service.ts` + `owner.schemas.ts`
- `src/common/schedule.ts`
- `src/common/product-lookup.ts`
- `src/common/saas-plan.ts`
- `src/common/document.ts`
- `src/consulta/*`
- `src/notifications/*`
- `src/dashboard/dashboard.metrics.ts`
- `src/products/*`
- `handoff.md`

Do not copy TypeScript verbatim; reimplement in idiomatic Quarkus/Java while preserving observable API behavior.
