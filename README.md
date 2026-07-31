# Trikot-Auktion

A small web app for running a jersey-auction fundraiser for a football club's youth program. Each first-team player's jersey is put up for auction; the highest bidder wins it, with proceeds going to the club's youth teams.

Anyone with the link can browse jerseys and place bids — no account needed. A password-protected admin panel lets the club board manage jerseys (name, starting price, photos), set the auction end time, and review/remove individual bids.

Built with Next.js (Pages Router) + TypeScript, using Upstash Redis for data storage and Vercel Blob for photo uploads.

## Running locally

### Prerequisites
- Node.js 18.18+ (20+ recommended)
- An Upstash Redis database (free tier is enough)
- A Vercel Blob store (only needed if you want photo uploads to work locally too)

### 1. Install dependencies
npm install

### 2. Set up environment variables
Copy the example file and fill in your own values:
cp .env.example .env.local

ADMIN_PASSWORD=choose-a-password
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
BLOB_READ_WRITE_TOKEN=...

Easiest way to get the Upstash/Blob values: create a Vercel project, connect an Upstash Redis and a Vercel Blob store to it under Storage, then pull the values locally with the Vercel CLI:
npm i -g vercel
vercel link
vercel env pull .env.local

### 3. Start the dev server
npm run dev

Open http://localhost:3000

### 4. Open the admin panel
Click the gear icon in the bottom-right corner and enter the password from ADMIN_PASSWORD.