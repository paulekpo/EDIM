# TikTok Content Gamification App (EDIM)

## Overview

EDIM (Entertainment Data to Idea Management) is a gamified content creation assistant MVP designed to help creators manage their content workflow. The application features an Ideas Wheel for random idea selection, an Achievement Wheel for tracking tier progression, and automatic project completion when all checklist items are checked. The system supports multiple users with individual accounts - each user has their own unique wheel, ideas, analytics, and progress tracking.

### Authentication
- **Provider**: Replit Auth via OpenID Connect (OIDC)
- **Features**: Supports Google, GitHub, Apple, email/password login
- **Session Storage**: PostgreSQL with connect-pg-simple
- **User Data**: Each user has separate ideas, analytics imports, and tier progress

### Admin System
- **Primary Admin**: paul.ekpo9@gmail.com (auto-set on login)
- **Admin Dashboard**: /admin route with stats and user management
- **Features**: View all users, toggle admin status, see platform statistics
- **Access Control**: Non-admins see "Access Denied" page, admin nav link only visible to admins

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth UI transitions and wheel animations
- **Component Pattern**: Path aliases configured (`@/` for client src, `@shared/` for shared code)
- **PWA Support**: Progressive Web App with installable mobile experience

### Progressive Web App (PWA)
- **Manifest**: `client/public/manifest.json` with app name, icons, theme colors
- **Service Worker**: `client/public/sw.js` for offline caching and SPA navigation fallback
- **Icons**: Multiple sizes (72-512px) in `client/public/icons/`
- **Install Prompt**: Shows on mobile devices with iOS-specific instructions
- **Offline Support**: Static assets cached, API failures return friendly error messages
- **Standalone Mode**: Full-screen experience without browser chrome

### Backend Architecture
- **Framework**: Express.js (v5) with TypeScript running on Node.js
- **API Pattern**: RESTful API endpoints under `/api/` prefix
- **Build System**: Custom build script using esbuild for server bundling and Vite for client
- **Development**: tsx for TypeScript execution, hot module replacement via Vite

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Migrations**: Drizzle Kit with migrations stored in `/migrations`
- **Key Tables**: users, ideas, checklist_items, analytics_imports, notifications, conversations, messages

### Core Business Logic Rules
- Ideas Wheel only spins when 2+ ideas are present
- Achievement Wheel is static (display only, does not spin)
- Auto-completion triggers when all checklist items are checked (no manual complete button)
- No deadline or due date pressure on projects
- Tier progression: Amateur (5 videos @ 20% each), Professional (10 @ 10%), Expert (15 @ 6.67%)
- Color-coded idea states: white=unstarted, green=in-progress, gray=skipped
- Duplicate ideas prevented via semantic similarity checking

### AI Integration
- OpenAI API for idea generation and duplicate detection
- Configured via environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- AI service located in `server/services/aiService.ts`
- Supports voice chat, image generation, and batch processing through replit integrations

## External Dependencies

### Database
- PostgreSQL database required
- Connection via `DATABASE_URL` environment variable
- Uses `connect-pg-simple` for session storage

### AI Services
- OpenAI API (or compatible endpoint via Replit AI Integrations)
- Used for: idea generation, duplicate detection, analytics screenshot parsing
- Voice/audio processing capabilities available

### Key NPM Dependencies
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `@tanstack/react-query` - Server state management
- `framer-motion` - Animations
- `openai` - AI API client
- Full shadcn/ui component suite via Radix UI primitives