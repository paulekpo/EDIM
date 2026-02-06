# EDIM (Entertainment Data to Idea Management)

## Overview
EDIM is a gamified content creation assistant MVP designed specifically for TikTok creators. It solves the "blank page problem" by turning raw analytics data into actionable, gamified tasks.

**Core Philosophy:** Data-driven creativity without the stress.
- No deadlines.
- No "due dates".
- No pressure.
- Just spin the wheel and create.

## Key Features

### 1. AI-Powered Intelligence (Google Gemini)
The entire application is powered by **Google Gemini (`gemini-1.5-flash`)**, replacing older OpenAI integrations for speed and cost-efficiency.
- **Analytics Parsing**: Upload screenshots of your TikTok analytics. Gemini Vision reads the traffic sources (For You Page vs. Search) and extracts top search queries.
- **Script Generation**: Based on *your* specific data, Gemini generates unique "How-To" video ideas tailored to what your audience is already searching for.

### 2. Gamified Workflow
- **The Ideas Wheel**: A visual spinner that selects your next project. It only spins when you have 2+ ideas, preventing decision paralysis.
- **The Achievement Wheel**: A static progress tracker that visualizes your journey through the tiers.
- **Tier System**:
  - **Amateur**: 5 videos (20% progress each)
  - **Professional**: 10 videos (10% progress each)
  - **Expert**: 15 videos (6.67% progress each)

### 3. Stress-Free Management
- **Smart Checklists**: Every idea comes with a 4-step actionable checklist.
- **Auto-Completion**: There is no "Complete" button. The project automatically marks itself as done when you check the final box, triggering a confetti celebration and updating your progress.
- **Color-Coded Status**:
  - White: Unstarted
  - Green: In Progress
  - Gray: Skipped

## Technical Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js (v5)
- **Language**: TypeScript
- **Database**: PostgreSQL (with Drizzle ORM)
- **AI Provider**: Google Gemini (`@google/generative-ai`)
- **Authentication**: Google OAuth 2.0 (`passport-google-oauth20`) via Passport.js

### Frontend
- **Framework**: React (v18)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn UI
- **State Management**: TanStack Query
- **Routing**: Wouter

## User Guide

1.  **Login**: Sign in securely using your Google account.
2.  **Upload**: Go to the dashboard and upload a screenshot of your TikTok analytics.
3.  **Generate**: Let Gemini analyze the data and propose 8 high-potential video ideas.
4.  **Spin**: Click "Spin" on the Ideas Wheel to let fate decide your next video.
5.  **Create**: Follow the checklist. Once you check the last item, the project completes automatically, and you level up!
