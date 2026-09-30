# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

A ride-pooling MVP for Dhaka's three-wheeled "Teslas". **Nusrat** is late and books Banani → Mohakhali. Two minutes later **Rafiq** books almost the same route to Gulshan 1. The app decides in about a second that they can share **Jashim**'s three-seat Tesla **Bullet**, gives each of them their own fair fare, and doesn't let **Shirin** take a seat that isn't there.

| | |
|---|---|
| 🎬 **Demo video** | _link added at release_ |
| 🌐 **Live deployment** | **https://tesla-pool-indol.vercel.app**. Sign in with any [demo account](#quick-start). API: https://tesla-pool-api.vercel.app/api/health |
| 📐 **Design document** | [docs/DESIGN.md](docs/DESIGN.md): assumptions, matching rule, fare model, lifecycle, schema, concurrency |
| 📈 **Scaling bonus** | [docs/SCALING.md](docs/SCALING.md): "If Oi Tesla goes viral" |

**Contents:** [Quick start](#quick-start) · [Features](#features) · [Screenshots](#screenshots) · [Architecture](#architecture) · [Database](#database) · [Tech choices](#tech-choices) · [Project structure](#project-structure) · [Environment](#environment-variables) · [Local development](#local-development-without-docker-for-the-apps) · [Tests](#tests) · [API](#api-overview) · [Decisions](#key-decisions-and-trade-offs) · [Limitations](#known-limitations) · [Next](#next-improvements) · [Git workflow](#git-workflow) · [AI usage](#ai-usage)

---

## Quick start

Requirements: **Docker** with Compose v2. Nothing else.

```bash
git clone https://github.com/nabilanewaz/Lesgoo.git && cd Lesgoo
docker compose up --build
```

Open **http://localhost:3000**. The first start builds the images (a few minutes). On every start the API applies database migrations and seeds the cast, then the web app comes up.

**Demo accounts** (password for all: `rickshaw123`):

| Who | Email | Role | Notes |
|---|---|---|---|
| Jashim | `jashim@teslapool.dev` | Driver | Drives **Bullet**, 3 seats, plate DHAKA-TESLA-01 |
| Karim | `karim@teslapool.dev` | Driver | Drives **Toofan**, a second Tesla, to show two drivers competing |
| Nusrat | `nusrat@teslapool.dev` | Passenger | Banani → Mohakhali, running late |
| Rafiq | `rafiq@teslapool.dev` | Passenger | Banani → Gulshan 1, two minutes later |
| Shirin | `shirin@teslapool.dev` | Passenger | Wants the last seat |

**Try the story:** in one browser window sign in as Jashim and go online. In a private window sign in as Nusrat and book Banani → Mohakhali. Accept her as Jashim. Then sign in as Rafiq and book Banani → Gulshan 1: he joins Bullet on his own. Arrive, start, and drop them off from Jashim's dashboard.

Ports taken? `WEB_PORT=8080 API_PORT=8081 DB_PORT=5434 docker compose up`. To start from an empty database: `docker compose down -v`.

## Features

**Passenger (Nusrat, Rafiq, Shirin)**
- Sign up and sign in (httpOnly cookie session). Gender is self-declared (woman, man, or prefer not to say) and only used for same-gender rides.
- Book a ride:
  - **area, then an exact pickup and drop-off spot** (a landmark such as *Kakoli bus stop*), and 1–3 seats;
  - see the **price alone and the price if shared** before booking;
  - pay with cash or a simulated TeslaPay.
- Choose how to share:
  - **share** (25% off if the Tesla is actually shared);
  - **ride alone**;
  - **same-gender only** (women with women, men with men, enforced both ways).
- Live status that refreshes itself:
  - the steps: waiting → matched → driver arrived → riding → completed / cancelled;
  - the **meeting spot** with a maps link;
  - co-riders' **gender only** (never names or destinations).
- Cancel for free until the trip starts. "Share with anyone instead" if a same-gender match is slow.
- Ride history, each ride's own timeline, and a fare breakdown you can check by hand.

**Driver (Jashim with Bullet)**
- Go online or offline. **"Auto-add riders heading my way"** switch: on, compatible riders join automatically; off, they wait for Accept.
- Feed of relevant waiting riders. With a trip open, only riders who fit its seats and route.
- Accept, then "I've arrived" (locks the passenger list), then "Start trip" (fixes every fare). Then **drop each passenger off separately**; the trip ends with the last one.
- **Pick-up spot in large Bangla text** with a **🧭 Navigate** button that opens Google Maps directions.
- Built for the roadside (big buttons, Bangla first with icons, at most one question per action):
  - *Reached*;
  - *Got off early* (pick the place, they pay only for what they rode);
  - *Tesla broke down* (🛞 / 🔋 / ⚠️: passengers on board pay nothing, the Tesla goes offline).
- Seats taken, each passenger's fare, and past trips with earnings.

**Pool rules the system guarantees**
- **Seats taken never exceed capacity**, even when two people claim the last seat at the same instant (§8 of the design).
- One active ride per passenger. One active trip per Tesla. Every state change is valid or rejected with `409`.
- Every change is written to an append-only **audit trail** (`ride_events`), so "what happened?" always has an answer.

## Screenshots

Captured from a fresh `docker compose up` with the seeded cast.

| Nusrat books: price alone vs shared | Jashim sees her waiting |
|---|---|
| ![Booking form](docs/screenshots/02-nusrat-books.png) | ![Driver feed](docs/screenshots/03-jashim-sees-nusrat.png) |
| **Rafiq and Shirin join: Bullet is full, pick up at কাকলী** | **Rafiq (phone): where to meet, who he's sharing with** |
| ![Bullet full](docs/screenshots/04-jashim-full-bullet.png) | ![Rafiq matched](docs/screenshots/05-rafiq-matched-phone.png) |
| **On the road: one button per passenger** | **"Tesla broke down": one picture tap** |
| ![On the road](docs/screenshots/06-on-the-road.png) | ![Breakdown question](docs/screenshots/07-breakdown-question.png) |
| **Nusrat's final fare: ৳70 − 25% = ৳52.50** | **Home page** |
| ![Fare breakdown](docs/screenshots/09-nusrat-fare.png) | ![Home](docs/screenshots/01-home.png) |

## Architecture

```mermaid
flowchart LR
    B[Browser] -->|HTTP| W[Next.js 16 web<br/>App Router, port 3000]
    W -->|/api/* rewrite<br/>same origin, httpOnly cookie| A[Node.js API<br/>Express 5 + TypeScript, port 4000]
    A -->|Prisma, plus raw SQL for seat claims and locks| D[(PostgreSQL 17)]
    B -. Navigate / Open in Maps .-> G[Google Maps app]
```

- **The browser only talks to Next.js.** Next.js forwards `/api/*` to Express, so the session cookie is same-origin and `httpOnly`: JavaScript can't read it, and there's no CORS to configure.
- **The API is a modular monolith:** `auth`, `rides`, `driver`, `pools`, `zones`, `health`. Each module has routes (HTTP and validation), a service (business rules), and a view (the JSON shape).
  - The rules that matter (matching, fares, state machines) are **pure functions** in `api/src/domain`, unit-tested without HTTP or a database.
- **REST with command endpoints** for state changes (`POST /driver/pool/start`) instead of `PATCH {status}`. Each transition has its own rules and side effects, such as fixing fares at start.
- **Data integrity lives in Postgres:** one transaction per action, conditional updates, row locks in a fixed order, CHECK constraints and partial unique indexes. So correctness doesn't depend on there being one API process.

## Database

Full ERD, and the reason for every table, constraint and index: [DESIGN.md §7](docs/DESIGN.md#7-database-schema). In short:

```mermaid
erDiagram
    users ||--o| vehicles : "drives"
    users ||--o{ ride_requests : "books"
    vehicles ||--o{ pools : "runs"
    pools ||--o{ ride_requests : "members"
    zones ||--o{ spots : "contains"
    spots ||--o{ ride_requests : "pickup / dropoff"
    spots ||--o{ pools : "meeting spot"
    ride_requests ||--o{ ride_events : "history"
    pools ||--o{ ride_events : "history"
```

- **`pools` is a Tesla's trip.** It keeps its own `capacity` and a `seats_taken` counter, protected by `CHECK (seats_taken <= capacity)`.
- **`ride_requests` is one passenger's ride.** It holds their own status, fare and spots, and points to its pool (membership is a foreign key, so a ride can't be in two pools).
- **Money is integer paisa**, never floats (৳52.50 = `5250`), so every sum is exact.
- **`ride_events` is append-only:** every state change, with who did it and why.
- **Migrations** are in `api/prisma/migrations`, as plain reviewable SQL. They are forward-only, and reference data (zones, spots) is inserted by the migrations.

## Tech choices

The stack PRD mandates Next.js/React and Node.js. For every other choice, here's the alternative, why this one fits ride-pooling, and what would make me switch:

| Choice | Picked | Realistic alternatives | Why it fits this MVP | Would switch when |
|---|---|---|---|---|
| Database | **PostgreSQL 17** | MySQL, SQLite, MongoDB | Pooling is a consistency problem: row locks, `SELECT … FOR UPDATE`, conditional updates, CHECK constraints and partial unique indexes ("one active ride per passenger") do the hard work, and DDL is transactional | Rarely. Add PostGIS for real geography; shard by city at very large scale |
| ORM | **Prisma 6** | Drizzle, TypeORM, Knex / raw SQL | Typed queries, readable schema, SQL migrations you can review. Raw SQL where it matters (seat claim, locks) | Heavy SQL-first work (reporting, complex locking) → Drizzle or Kysely |
| API framework | **Express 5 + TypeScript** | NestJS, Fastify | Small, well known, async errors handled natively in v5. A modular monolith doesn't need DI containers | Many teams or modules → NestJS for structure; raw throughput → Fastify |
| Validation | **Zod 4** | Joi, class-validator | One schema gives runtime checks *and* TypeScript types; also validates env vars at startup | Sharing a contract with other clients → generate from OpenAPI |
| Auth | **JWT in an httpOnly, SameSite=Lax cookie**, bcrypt passwords | Server-side sessions table or Redis, Auth.js, Clerk | Stateless, no session store, safe from XSS token theft; same-origin via the Next.js rewrite, so no CORS | Need "log out everywhere" or instant revocation → server-side sessions or refresh-token rotation |
| Live updates | **SWR polling every 3 s** | WebSockets, Server-Sent Events | Rides take minutes, so 3 s is invisible; nothing to scale or reconnect | Many concurrent users → push gateway (see [SCALING.md](docs/SCALING.md)) |
| Styling | **CSS Modules + design tokens** | Tailwind, MUI, Chakra | A custom rickshaw-art look (painted plates, Bangla type) is easier to own in plain CSS; no runtime | A larger team wanting shared utilities → Tailwind |
| Tests | **Vitest + Supertest against a real Postgres** | Jest; mocking the database | The risky parts (locks, constraints, races) only exist in a real database, so tests run the real migrations | Suite too slow → run test files in parallel against separate databases |
| Logging | **pino** (JSON, pretty in dev) | winston, console | Fast structured logs with request ids; secrets redacted | Central platform → ship JSON to it, no code change |
| Rate limiting | **express-rate-limit** (in memory) | Redis-backed limiter, gateway limits | Enough for one process: 10 failed logins or 20 sign-ups per 15 min per IP | More than one API instance → Redis store |
| Container | **Docker Compose**, multi-stage images | Kubernetes, bare VMs | One command runs db, api and web with health-checked start order | Real traffic → managed Postgres plus a container host |
| Hosting | **Vercel** (web, and the API as one serverless function) + **Neon** Postgres, all free tier, in Singapore | Render, Railway, Fly.io; a VPS running the Docker setup | Free with no card; Next.js runs natively; Express runs unchanged as a function; Neon is real Postgres, so the locks and constraints behind the seat guarantee work exactly as locally; Singapore is the closest region to Dhaka | Long-lived connections (WebSockets), background matching workers or steady traffic → run the same Docker images on a container host (Render or Fly.io) with managed Postgres |

## Project structure

```
.
├── docker-compose.yml         db + api + web, health-checked start order
├── docs/
│   ├── DESIGN.md              the thinking: rules, lifecycle, schema, concurrency
│   ├── SCALING.md             viral-scale bonus
│   └── screenshots/
├── api/                       Express + TypeScript + Prisma
│   ├── Dockerfile, docker-entrypoint.sh   (migrate → seed → start)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/        SQL, incl. CHECKs, partial unique indexes, zones and spots
│   │   └── seed.ts            the cast: Jashim, Karim, Nusrat, Rafiq, Shirin
│   ├── src/
│   │   ├── domain/            pure rules: fare, matching, geo, ride/pool state machines
│   │   ├── modules/           auth · rides · driver · pools · zones · health
│   │   │                      (routes → service → view in each)
│   │   ├── middleware/        auth guard, error handler
│   │   ├── lib/               prisma, logger, errors, audit events
│   │   └── config/env.ts      env vars validated at startup
│   └── test/                  Vitest + Supertest, real Postgres
└── web/                       Next.js App Router
    ├── Dockerfile
    └── src/
        ├── app/               / · /login · /signup · /ride · /ride/history · /driver
        ├── components/        ride/ · driver/ · trip/ · ui/ · art/ (rickshaw-art motifs)
        └── lib/               api client, SWR hooks, types, labels, formatting
```

## Environment variables

Examples with safe defaults: [`api/.env.example`](api/.env.example), [`web/.env.example`](web/.env.example). Real `.env` files are git-ignored. Docker Compose sets everything itself, so no `.env` is needed for `docker compose up`.

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | api | `postgresql://tesla:tesla@localhost:5432/tesla_pool` | Postgres connection |
| `JWT_SECRET` | api | none locally; a demo-only value in Compose | Signs session tokens, at least 16 characters. **Use a long random value anywhere real** |
| `COOKIE_SECURE` | api | `false` | `true` when served over HTTPS |
| `PORT`, `LOG_LEVEL`, `NODE_ENV` | api | `4000`, `info`, `development` | |
| `SEED_DEMO_DATA` | api (Docker) | `true` | Seed the cast on start (upserts, safe to repeat) |
| `API_URL` | web (build time) | `http://localhost:4000` (Compose: `http://api:4000`) | Where Next.js forwards `/api/*` |
| `WEB_PORT`, `API_PORT`, `DB_PORT` | Compose | `3000`, `4000`, `5432` | Host ports |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose | `tesla`, `tesla`, `tesla_pool` | Database container |

## Local development (without Docker for the apps)

Requirements: Node.js 20+ (the Docker images use 22), Docker (for Postgres).

```bash
docker compose up -d db                 # just Postgres

cd api
cp .env.example .env
npm ci
npm run db:migrate                      # apply migrations
npm run db:seed                         # the cast
npm run dev                             # http://localhost:4000 (restarts on change)

cd ../web                               # in a second terminal
cp .env.example .env.local
npm ci
npm run dev                             # http://localhost:3000
```

Useful scripts: `api`: `npm run typecheck`, `npm run build`, `npx prisma studio`. `web`: `npm run lint`, `npm run build`.

## Tests

```bash
docker compose up -d db                 # tests need Postgres
cd api && npm test
```

The tests create their own `tesla_pool_test` database and apply the real migrations, so constraints and indexes are tested too. They never touch development data. **125 tests in 8 files.** How they cover what the brief asks for:

| Brief asks | Where |
|---|---|
| Bullet's capacity can never be exceeded | `pooling.test.ts`: over-capacity requests, direct seat claims, a raw overbooking `UPDATE` rejected by the CHECK |
| Two concurrent requests can't corrupt capacity | `pooling.test.ts`: Nusrat and Shirin race for the last seat; 8 passengers race for 2 seats; two drivers accept the same rider |
| Invalid state transitions are rejected | `driver.test.ts`, `rides.test.ts`, `domain.test.ts`: start before arrive, double "Start trip", cancel after start |
| Nusrat's and Rafiq's pooled fares | `domain.test.ts` (৳52.50 / ৳67.50 by hand), `driver.test.ts` (end to end) |
| Users can't touch another user's ride | `rides.test.ts`: another passenger's ride is `404`; `mid-trip.test.ts`: a driver can't drop off someone else's passenger |
| Cancellation rules | `rides.test.ts`, `pooling.test.ts`: seats given back, empty trip cancelled, no cancelling mid-trip |
| Also | sharing and same-gender rules (`preferences.test.ts`), drop-offs, early fares and breakdowns (`mid-trip.test.ts`), spot fares and the meeting-spot walk limit (`pickup-spots.test.ts`), auth and validation (`auth.test.ts`) |

The race tests don't rely on lucky timing. Where two requests must collide, the test holds the trip's row lock until both are queued behind it. Each safeguard was also **mutation-tested**: removing it makes a test fail. Examples: the atomic seat claim, the pool lock, the "still STARTED" drop-off condition, and the walking limit.

## API overview

All under `/api`. JSON in, JSON out. Errors are `{ "error": { "code", "message", "details?" } }` with `400` (validation), `401`, `403` (wrong role), `404` (not found, or not yours), `409` (state conflict: seat taken, trip already started, double tap) and `429` (rate limit).

| Method & path | Who | What |
|---|---|---|
| `GET /health` | anyone | API and database status (Docker health check) |
| `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | anyone / signed in | Session in an httpOnly cookie (`Authorization: Bearer` also accepted for API clients) |
| `GET /zones` | anyone | Areas with their pickup and drop-off spots |
| `GET /rides/estimate?pickupSpot=&dropoffSpot=&seats=` | anyone | Price alone and if shared (`pickupZone` / `dropoffZone` also accepted = main spot) |
| `POST /rides` | passenger | Request a ride; joins a compatible trip straight away if one exists |
| `GET /rides`, `GET /rides/current`, `GET /rides/:id`, `GET /rides/:id/events` | passenger (own rides only) | History, active ride, one ride, its timeline |
| `POST /rides/:id/cancel`, `POST /rides/:id/share-with-anyone` | passenger | Cancel (before the trip starts); relax a same-gender request |
| `GET /driver/me`, `POST /driver/online`, `POST /driver/offline`, `POST /driver/auto-accept` | driver | Vehicle, active trip, availability, auto-add switch |
| `GET /driver/requests`, `POST /driver/requests/:id/accept` | driver | Relevant waiting riders; accept one |
| `POST /driver/pool/arrive`, `/start`, `/complete`, `/cancel` | driver | Trip lifecycle |
| `POST /driver/rides/:id/drop-off` `{ zone? }` | driver | Drop one passenger off: at their destination, or early at an area on the way |
| `POST /driver/pool/breakdown` `{ reason }` | driver | End the trip: nobody on board pays, the Tesla goes offline |
| `GET /driver/pools` | driver | Trip history with earnings |

## Key decisions and trade-offs

Each decision is written up in detail in [DESIGN.md](docs/DESIGN.md).

- **Two linked state machines** (the trip and each passenger's ride) instead of one status. Rafiq cancelling must not cancel Nusrat. Cost: two tables to keep in step, always updated in one transaction.
- **Fares are fixed when the trip starts.** That's the first moment we know for sure who shared. Before that, the passenger sees both prices.
- **The trip locks when the driver arrives.** Jashim needs a final list before he leaves. Late riders wait for the next Tesla.
- **The last seat:** one conditional `UPDATE … WHERE seats_taken + n <= capacity`, plus a `FOR UPDATE` lock so the *route* check can't race either, plus a CHECK constraint as a backstop.
  - Chosen over app-level locks or a queue: correct with any number of API processes, and simple.
  - At scale: matching per zone off the request path ([SCALING.md](docs/SCALING.md)).
- **Consent and safety over maximum pooling.** Riders can ride alone or ask for same-gender rides, enforced both ways. Co-riders see gender only. Each driver chooses whether riders are added automatically.
- **Mid-trip reality:**
  - passengers are dropped off one by one, and pay only for what they rode if they get off early;
  - a breakdown frees everyone on board of any charge;
  - the roadside buttons were designed for drivers who may not read English well.
- **Places drivers know:** 30 landmark spots (checked on OpenStreetMap) with Bangla names, per-100 m fares, and one meeting spot per trip within a 500 m walk.
- **Polling, not WebSockets.** Simpler and good enough when rides take minutes.

## Known limitations

- **Geography is a grid.**
  - Distances are Manhattan distance on a hand-made km grid, not real roads.
  - Spot positions are offset from their area's point by real distances, but the areas themselves are approximate.
  - There's no GPS: "got off early" and breakdowns are located by area.
- **Gender is self-declared** and not verified. It's a safety preference, not an identity check.
- **Logout only clears the cookie.** A copied token stays valid until it expires (7 days), because there's no server-side revocation.
- **Rate limits live in memory:** per process, and reset on restart. On Vercel, each copy of the API function keeps its own counter, so the live limit is looser than "10 per IP" (see [Deployment](#deployment)).
- **Drivers can't sign up.** Drivers and Teslas come from seed data (a real service would verify them first).
- **Payments are recorded, not processed.** TeslaPay is simulated.
- **No automated browser tests.** The UI was checked with scripted browser runs during development, but those scripts aren't part of the test suite.
- **No favicon yet.**

## Next improvements

1. **Push instead of polling** (WebSocket or SSE from the ride events already written).
2. **Real routes and ETAs:** PostGIS plus a routing service; GPS-based early drop-off and breakdown location.
3. **Server-side sessions** or refresh-token rotation for real logout; a Redis-backed rate limiter.
4. **Driver onboarding and verification;** a fully Bangla driver interface, with voice prompts.
5. **Ratings and reports after each ride;** a support view over the audit trail.
6. **End-to-end browser tests** (Playwright) in CI.

## Deployment

**Live:** https://tesla-pool-indol.vercel.app. All free tier, no card.

```mermaid
flowchart LR
    B[Browser] --> W["Vercel: tesla-pool (Next.js)<br/>tesla-pool-indol.vercel.app"]
    W -->|/api/* rewrite, same origin| A["Vercel: tesla-pool-api<br/>Express as one function, region sin1 (Singapore)"]
    A -->|pooled connection| D[("Neon Postgres<br/>ap-southeast-1 (Singapore)")]
```

| Piece | Where | Settings |
|---|---|---|
| Web | Vercel project `tesla-pool`, root directory `web` | `API_URL=https://tesla-pool-api.vercel.app` (read at build time) |
| API | Vercel project `tesla-pool-api`, root directory `api`, Express preset | `JWT_SECRET` (secret), `COOKIE_SECURE=true`, `NODE_ENV=production`; region pinned in [`api/vercel.json`](api/vercel.json) |
| Database | Neon, connected to the API project | `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` added by the integration |

**How it's deployed:**
- **Both projects deploy from GitHub.** The production branch is the release branch, so the live site is exactly the version in the video.
- **Migrations and the seed run by hand, against the direct (unpooled) connection:** `DATABASE_URL=<unpooled> npx prisma migrate deploy && npm run db:seed`. They don't run on every build, so a preview build can never change the production database.
- **What makes the API work on Vercel:**
  - `src/server.ts` is the only entry file; Vercel runs it and takes over its `listen()`;
  - Prisma also builds its engine for Vercel's Linux (`binaryTargets` in the schema), generated by `postinstall`.

**Checked on the live site:**
- **A full trip** through the web domain: book from a spot, accept, arrive, start, drop off, and the fare the passenger sees.
- **The session cookie** is `HttpOnly; Secure; SameSite=Lax`.
- **The login rate limiter** counts per visitor IP, including through the web → API rewrite (it doesn't see one shared proxy address).

**Free-tier behaviour:**
- **The first request after idle time is slower**, while the Neon database wakes up (about a second).
- **Rate-limit counters are per function instance** (see [Known limitations](#known-limitations)).

## Git workflow

- **Branches:**
  - `master` is the integration branch;
  - `feature/*` holds each logical change (for example `feature/sharing-preferences`, `feature/mid-trip-events`, `feature/pickup-spots`, `feature/docker`), merged with `--no-ff` so every feature stays visible in the history;
  - `pre-release` is cut from `master` for docs, deployment and final checks;
  - `release/v1.0.0` is cut from `pre-release` and is the version shown in the video.
- **Commits** follow `<type>(<scope>): <description>` (feat, fix, test, docs, build, refactor, chore). Each commit is one reviewable change.

## AI usage

**Tool:** Claude Code (Anthropic's Claude, in VS Code), used as a pair programmer throughout.

**What for:**
- talking through the design (matching rule, fare model, lifecycle, concurrency) before writing code;
- writing code and tests;
- researching real-world practice: Uber's rules for early drop-offs and breakdowns, interface guidelines for low-literacy users, and OpenStreetMap coordinates for Dhaka landmarks;
- running browser checks, and drafting documentation.

**How I worked with it:**
- I reviewed every change before committing it myself. The AI never committed or pushed.
- I made the product decisions, and it had to justify its proposals.
- I can explain every part of the code, and I changed several parts after questioning them.

**Accepted suggestion: how the last seat is claimed.** When Nusrat and Shirin race for Bullet's last seat, it proposed three things:
- one conditional SQL `UPDATE` that only succeeds while `seats_taken + seats <= capacity`;
- a `SELECT … FOR UPDATE` lock so the route check can't race either;
- a CHECK constraint as a backstop.

I accepted it after checking the reasoning: at READ COMMITTED, Postgres re-checks the WHERE clause after the first transaction commits. I also had it prove the tests work: we swapped in a naive read-then-write and removed the constraint, and the race tests failed (both women got the seat).

**Rejected or changed suggestions, and why:**
1. **"Prefer women passengers" → symmetric same-gender rides.** The first proposal was a one-sided option for women to *prefer* women co-riders. I rejected it:
   - it felt creepy and unfair;
   - it ignored conservative men who don't want to share a ride with women either.

   We replaced it with a rule that works the same for everyone. Riders declare their gender (optionally) and can choose "same gender only", which is enforced both ways. Co-riders see only each other's gender, never names, and can cancel for free.
2. **Auto-matching everyone → the driver's choice.** It proposed adding every compatible rider to an open trip automatically. I pointed out that a driver may not want to go to a certain area, or may have other plans. So each driver now has an **auto-add switch**; with it off, riders wait until he accepts them.
3. **Pickup by area → landmark spots drivers can read.** "Pickup at Banani" isn't enough, and one area can have very different distances. I asked for places a driver understands, and for fares that differ inside an area. We checked 30 landmarks on OpenStreetMap, with Bangla names first and a Navigate button, and priced fares per 100 m from the exact spot. For the unclear pins (Amtoli, Gulshan 1 Circle, Bashundhara, Dhanmondi 15 vs Shankar), I asked it to research instead of guessing.

**Where it went wrong, and what that taught me:**
- **It touched my test data.** Early browser-test scripts cancelled my own test rides and once added a test rider to my trip. After that, test scripts only used separate accounts in an area I wasn't using.
- **It opened a hole in the cancel rules.** Letting a breakdown cancel a started ride would also have let a *passenger* cancel mid-trip. The existing tests caught it before it shipped, which is why I insisted on tests for every rule.
