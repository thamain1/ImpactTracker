# ImpactTracker - Nonprofit Impact Tracking Application

## Overview
A full-stack web application for nonprofit organizations to measure, track, and report program impact across different geographic levels (SPA, City, County, State). Built with Express + React + PostgreSQL.

## Architecture
- **Backend**: Express.js with TypeScript, Drizzle ORM, PostgreSQL (Neon-backed)
- **Frontend**: React + Vite, TailwindCSS, Shadcn/UI components, Recharts for data visualization
- **Auth**: Replit Auth (OIDC-based)
- **Routing**: wouter (frontend), Express (backend)

## Project Structure
```
shared/           # Shared types, schemas, routes contract
  schema.ts       # Drizzle ORM table definitions + Zod schemas
  routes.ts       # API contract definitions
  models/auth.ts  # Auth user/session tables
server/
  routes.ts       # Express API route handlers
  storage.ts      # Database storage layer (IStorage interface)
  db.ts           # Database connection
  replit_integrations/auth/  # Replit Auth setup
client/src/
  App.tsx          # Main app with routes + protected routes
  pages/           # Page components
    Landing.tsx    # Public landing page
    Dashboard.tsx  # Main dashboard with KPIs + geography tiles
    Programs.tsx   # Programs list (grid/table views with filters)
    ProgramDetails.tsx  # Individual program with charts
    ProgramWizard.tsx   # Multi-step program creation wizard
    Reports.tsx    # Reports with charts, raw data, CSV export
    AdminDashboard.tsx  # Cross-org admin stats
    Settings.tsx   # Org profile + team management
  components/
    SidebarNav.tsx      # Main sidebar navigation
    AddImpactDialog.tsx # Enhanced impact logging dialog
    CreateOrgDialog.tsx # Organization creation dialog
  hooks/
    use-auth.ts         # Auth hook
    use-programs.ts     # Program CRUD hooks
    use-impact.ts       # Impact data hooks
    use-organizations.ts # Organization hooks
    use-admin.ts        # Admin stats hook
    use-user-roles.ts   # User role management hooks
```

## Key Features
1. **Dashboard** - KPI cards, geography summary tiles, recent programs
2. **Programs** - Grid/table views, search/filter by status, create via multi-step wizard, delete with confirmation
3. **Program Details** - Impact charts by geography, KPI totals, recent entries table, CSV export
4. **Impact Logging** - Enhanced dialog with demographics, ZIP codes, outcomes, geography auto-suggestions
5. **Reports** - Charts + raw data tabs, program selector, CSV export
6. **Admin Dashboard** - Cross-org aggregate stats, geography breakdowns, recent programs
7. **Settings** - Organization profile editing, team member management (add by email, assign roles)

## Database Schema
- `organizations` - id, name, slug, address, phone, website, contactEmail
- `programs` - id, orgId, name, description, type, status (active/completed/draft), startDate, endDate, targetPopulation, goals, locations
- `impact_metrics` - id, programId, name, unit
- `impact_entries` - id, programId, userId, date, geographyLevel (SPA/City/County/State), geographyValue, zipCode, demographics, outcomes, metricValues (jsonb)
- `user_roles` - id, userId, orgId, role (admin/staff)
- `users` - Replit Auth managed
- `sessions` - Replit Auth managed

## API Endpoints
- `GET/POST /api/organizations` - List/Create orgs
- `GET/PUT /api/organizations/:id` - Get/Update org
- `GET/POST/DELETE /api/organizations/:orgId/roles` - User role management
- `GET/POST /api/programs` - List/Create programs
- `GET/PUT/DELETE /api/programs/:id` - Get/Update/Delete program
- `GET/POST /api/impact` - List/Create impact entries
- `GET /api/impact/stats` - Aggregated impact statistics
- `GET /api/impact/export` - CSV export
- `GET /api/admin/stats` - Admin aggregate statistics

## Running
- `npm run dev` starts both Express backend and Vite frontend on port 5000
- `npm run db:push` syncs database schema

## Recent Changes (Feb 2026)
- Expanded schema with program type, status, dates, target population, goals, locations
- Added organization profile fields (address, phone, website, email)
- Impact entries now support ZIP codes, demographics, outcomes
- Multi-step program creation wizard (4 steps: Basics, Details, Population & Goals, Metrics)
- Admin dashboard with cross-org aggregate stats
- Settings page with org profile editing + team management
- Programs page with grid/table view toggle, search, status filter, delete
- Reports page with charts/raw data tabs and CSV export
- Dashboard with geography summary tiles
