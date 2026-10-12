# AI Bot App (MERN + Groq AI)

This project is a simple MERN-style AI assistant website built with:

- MongoDB for optional chat storage
- Express.js for the backend API
- React + Vite for the frontend
- Groq AI for chat completions
- Groq TTS for voice output
- Optional Google Cloud Text-to-Speech fallback

## Project structure

- `server/` — Express API server
- `client/` — React frontend
- `.env.example` — sample environment variables

## Setup

1. Copy `.env.example` to `.env` and update the values.
2. Install dependencies:

   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

3. Start the app in development mode:

   ```bash
   npm run dev
   ```

4. Open the frontend at http://localhost:4179

## Environment variables

```env
PORT=5010
MONGODB_URI=mongodb://127.0.0.1:27017/aibot
GROQ_API_KEY=your_groq_api_key_here
DEFAULT_TTS_VOICE=Aria
FRONTEND_URL=http://localhost:4179
GOOGLE_TTS_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS=
```

## Notes

- The app will work with a valid Groq API key.
- If `MONGODB_URI` is not set, chat history is disabled but the app still runs.
- Groq TTS is used by default for voice playback.
- Google Cloud TTS can be enabled by setting `GOOGLE_TTS_ENABLED=true` and supplying a service account path.

## Production build

```bash
npm run build
npm run start
```
