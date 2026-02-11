# Local Development Setup for EDIM

To run EDIM (Entertainment Data to Idea Management) on your local machine, follow these steps.

## Prerequisites

*   **Node.js** (v20 or higher recommended)
*   **PostgreSQL** (running locally or a remote connection string)
*   **Google Cloud Project** (for OAuth 2.0 and Gemini API)

## 1. Clone and Install

```bash
git clone <repository_url>
cd <repository_name>
npm install
```

## 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/edim_db

# Authentication (Google OAuth)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
SESSION_SECRET=your_super_secret_session_key

# AI (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=5000
NODE_ENV=development
```

### Obtaining Credentials

*   **Google OAuth**: Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project, and set up OAuth 2.0 credentials. Set the authorized redirect URI to `http://localhost:5000/api/auth/google/callback`.
*   **Gemini API**: Get an API key from [Google AI Studio](https://aistudio.google.com/).

## 3. Database Setup

Push the database schema to your PostgreSQL instance:

```bash
npm run db:push
```

## 4. Run the Application

Start the development server:

```bash
npm run dev
```

The application should now be accessible at `http://localhost:5000`.

## 5. Build for Production

To build and run in production mode:

```bash
npm run build
npm start
```
