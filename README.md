# Horde Havoc

A casual, physics-driven 3D crowd-multiplier tower defense game built with Three.js + Rapier, backed by a real-time Node.js leaderboard server.

## Quick Start

### 1. Start the backend

```bash
cd server
npm install
npm start
```

The server runs on `http://localhost:3000`.

### 2. Start the client dev server

```bash
cd client
npm install
npm run dev
```

Opens the game at `http://localhost:5173`.

## How to Play

1. Enter a temporary username (or play as a guest).
2. **Click and hold** anywhere on the screen to aim and fire Blue Normies from your cannon.
3. Move your mouse left/right to aim.
4. Units that pass through multiplier gates (x2, +5) create more units.
5. Get your units to the Red Base at the far end to score points.
6. Compete on the live leaderboard!

## Tech Stack

- **Client**: Three.js (3D rendering) + Rapier (WASM physics) + Vite (bundler)
- **Server**: Node.js + Express + Socket.io (real-time leaderboard)
- **Deployment**: S3 (static client) + EC2 (backend server)

## AWS Deployment

### Client (S3)

```bash
cd client
npm run build
# Upload dist/ to an S3 bucket configured for static website hosting
```

### Server (EC2)

```bash
# On your EC2 instance:
git clone <repo-url>
cd mob_defense/server
npm install
PORT=3000 node index.js
```

Update `SERVER_URL` in `client/src/network.js` to point to your EC2 public IP.
