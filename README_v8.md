# Kevin Spanish Tutor v8 — Documents + AI backend

This version keeps the iPhone/Documents-by-Readdle-friendly HTML frontend, but adds a real AI conversation backend.

## Architecture

**Documents by Readdle / iPhone**
→ opens `Kevin_Spanish_Tutor_v8_AI.html`
→ sends conversation requests to your hosted Node backend
→ backend calls the OpenAI Responses API
→ API key stays on the server and is never placed in the HTML

Documents supports `.html` files and has an internal web browser, so the frontend can be stored/opened there. The backend itself must be hosted somewhere that can run Node.js.

## Files

- `Kevin_Spanish_Tutor_v8_AI.html` — the complete tutor frontend.
- `kevin_ai_server_v8.mjs` — Node/Express AI backend.
- `package.json` — backend dependencies/start command.
- `.env.example` — environment-variable template.

## Local backend

1. Install a current Node.js release.
2. Put the three backend files in one folder.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env`.
5. Put your OpenAI API key in `OPENAI_API_KEY`.
6. Start:
   `npm start`
7. The backend health check is:
   `http://localhost:3000/health`

For the HTML opened from Documents on an iPhone, `localhost` means the iPhone, not your computer. Therefore the iPhone needs the backend's reachable network/host URL, or you should deploy the backend publicly.

## Documents setup

Open the HTML in Documents. In **AI Backend URL**, enter the public HTTPS URL of your hosted backend, for example:

`https://your-kevin-backend.example.com`

Tap **Save**. The status should change to **AI backend connected**.

You do not put the OpenAI API key into the HTML.

## Recommended deployment shape

For the easiest day-to-day use:

1. Deploy the Node backend to a normal HTTPS Node hosting service.
2. Set `OPENAI_API_KEY` in that service's secret/environment settings.
3. Set `OPENAI_MODEL=gpt-5.6-luna` (or another model available to your API account).
4. Copy the deployed HTTPS backend URL into Kevin once.
5. Keep the HTML in Documents and use it like an app.

The frontend remembers the backend URL on the device.

## Important

- Never publish `.env` or your API key.
- If the backend is public, keep the rate limit enabled.
- Use HTTPS for the deployed backend.
- The HTML can still run the normal lessons, adaptive difficulty, mastery, review, and progression even if the AI backend is temporarily unavailable.
