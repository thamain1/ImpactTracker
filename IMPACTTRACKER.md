# ImpactTracker

A web application built for nonprofit organizations to measure, track, and report the impact of their programs across different geographic areas. Helps organizations like **Sister of Watts** answer: How many people did we serve? Where? How does that compare to the population in that area?

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| UI | TailwindCSS + Shadcn/UI |
| Charts | Recharts |
| Routing | wouter |
| Data Fetching | TanStack Query (React Query v5) |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Auth | Replit Auth (OpenID Connect) |
| External APIs | U.S. Census Bureau API, OpenAI API |

> Frontend and API both served on **port 5000**.

---

## Core Features

### 1. Dashboard
- KPI tiles: total participants, programs, entries
- Charts: Participants by Month, Participants by Program, Resources by Program, Goal vs. Actual
- Geography summary tiles: cities, counties, SPAs, states
- Census Bureau comparison: population reach %, poverty rates, median income

### 2. Programs Management
- 4-step creation wizard: Basics → Details → Population & Goals → Metrics
- Tracks: type (Education, Healthcare, Food Security, etc.), status, date range, target population, age range, goals
- Grid and table view with search and status filtering
- Edit and delete with confirmation

### 3. Impact Logging
- Log entries per program: service date, geography level (SPA/City/County/State), location, ZIP, demographics, outcomes
- Metric values recorded per entry (e.g., 50 Participants, 200 Meals)
- `countsAsParticipant` flag — distinguishes people served from resources distributed
- Entries editable after creation

### 4. Reports
- Charts tab and raw data tab
- Filter by program
- CSV export for any dataset

### 5. Census Bureau Integration
- Real-time U.S. Census American Community Survey lookups
- Compares impact numbers against actual population data
- Shows: population reach %, poverty rate, median income
- Age-targeted demographic analysis (e.g., 10–17 year olds in served area)
- SPA-level data uses pre-computed LA County estimates
- Results cached 30 days for performance

### 6. Geographic Hierarchy Rollup
- Automatic rollup: City → County → State
- Also rolls up: City → SPA (LA County cities)
- Example: 50 participants logged in "Los Angeles" also counts toward Los Angeles County, California, and relevant SPAs

### 7. Admin Dashboard
- Cross-organization aggregate statistics
- Geography breakdowns across all orgs
- Recent programs overview

### 8. Settings & Team Management
- Edit org profile: name, mission, vision, address, contact info
- Invite team members by email
- Role-based access: `admin` | `can_edit` | `can_view` | `can_view_download`

### 9. AI-Enhanced PDF Reports
- Generate impact study reports using OpenAI

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `organizations` | Org profiles (name, mission, vision, contact info) |
| `programs` | Programs with type, status, dates, goals, locations |
| `impact_metrics` | Metric definitions per program (name, unit, countsAsParticipant) |
| `impact_entries` | Individual impact records — date, geography, demographics, metric values (JSONB) |
| `user_roles` | Maps users to orgs with role-based permissions |
| `users / sessions` | Managed by Replit Auth |
| `census_cache` | Cached Census API responses (30-day TTL) |

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/organizations` | List / create orgs |
| `GET/PUT /api/organizations/:id` | Get / update org |
| `GET/POST/DELETE /api/organizations/:orgId/roles` | Team member management |
| `GET/POST /api/programs` | List / create programs |
| `GET/PUT/DELETE /api/programs/:id` | Get / update / delete program |
| `PATCH /api/programs/:id/metrics/:id` | Update metric settings |
| `GET/POST /api/impact` | List / create impact entries |
| `GET /api/impact/stats` | Aggregated stats with geographic rollup |
| `GET /api/impact/export` | CSV export |
| `GET /api/dashboard/charts` | Chart data for dashboard |
| `GET /api/census/comparison` | Census comparison data |
| `POST /api/census/batch` | Batch census lookups |
| `POST /api/census/age-groups` | Age-targeted demographics |
| `GET /api/admin/stats` | Cross-org admin stats |

---

## Security

- **Multi-tenant data isolation** — users only see data for orgs they belong to
- **Role-based access control** on all API endpoints
- All endpoints verify user membership before returning data
- Session-based auth with server-side storage via Replit Auth

---

## Project Structure

```
ImpactTracker/
├── client/          # React frontend
├── server/          # Express API
├── shared/          # Shared types (Drizzle schema, etc.)
├── script/          # Utility scripts
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```
