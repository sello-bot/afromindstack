# AfromindStack MVP
React + Vite frontend with dark/light mode, dashboard, local-demo clients, quotes/invoices and a Flask API starter.

## Run in Codespaces
Frontend terminal:
```bash
cd client
npm install
npm run dev -- --host 0.0.0.0
```
Backend terminal:
```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Open port 5173 for the frontend. API health: port 5000 `/api/health`.

## Important MVP limitation
The UI demo stores clients/documents in the browser's localStorage. The Flask API starter includes health, client CRUD starter endpoints and a PDF template endpoint, but the UI is not yet wired to it. Do not use for real customer financial data until authentication, account isolation, server-side persistence, security controls, backups and South African tax/invoice requirements are implemented and tested.
