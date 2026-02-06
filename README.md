# EDIM (Entertainment Data to Idea Management)

> **Gamified, AI-powered content creation assistant for TikTok creators.**

EDIM turns your raw TikTok analytics into actionable video ideas using Google Gemini, all wrapped in a stress-free, gamified interface.

## Quick Start

1.  **Login** with your Google account.
2.  **Upload** a screenshot of your TikTok analytics.
3.  **Spin** the wheel to get your next video assignment.
4.  **Level Up** by completing projects to reach new tiers (Amateur -> Professional -> Expert).

## Key Features

*   **🤖 AI-Powered**: Uses Google Gemini (`gemini-1.5-flash`) for script generation and screenshot analysis.
*   **📊 Data-Driven**: Ideas are tailored to your specific traffic sources and search queries.
*   **🎡 Gamified**: Ideas Wheel, Achievement Wheel, and automatic tier progression.
*   **🔐 Secure**: Google OAuth 2.0 authentication.

For full documentation and architectural details, please see [EDIM Documentation](edim.md).

## Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS
*   **Backend**: Node.js, Express, Drizzle ORM
*   **AI**: Google Gemini
*   **Auth**: Google OAuth 2.0
