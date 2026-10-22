# SocialFlow — Social Publishing Platform

A full-stack starter dashboard for planning, validating, scheduling, publishing, and monitoring social media posts through the SocialClaw CLI described in the supplied skill file.

## Included

- Responsive web dashboard with dark/light mode
- Post composer with live preview and local queue
- 13 platform/provider choices supported by the supplied skill
- Server-side SocialClaw CLI integration for account listing, validation, publishing, run status, and post listing
- Local schedule persistence in `data/schedule.json`
- Local publish-attempt history in `data/runs.json`
- Server-side API key configuration; the key is not sent to browser code
- Local validation and SocialClaw validation before publish
- No automatic publication: the user must explicitly click Publish and confirm

## Requirements

- Node.js 20 or newer
- SocialClaw CLI installed and authorized with a workspace API key
- SocialClaw workspace: https://getsocialclaw.com/dashboard

## Run locally

1. Extract the ZIP and open a terminal in the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install the CLI:
   ```bash
   npm install -g socialclaw@0.1.12
   ```
4. Copy `.env.example` to `.env`, then set your real `SC_API_KEY`. Do not commit `.env`.
5. Start the server:
   ```bash
   npm start
   ```
6. Open `http://localhost:3000`.
7. Connect your social accounts in the SocialClaw dashboard. Use Accounts → Refresh.
8. Create a future-dated post, save it, and validate the schedule before publishing.

### Windows PowerShell environment alternative

If you do not want to use `.env`, set the key for the current shell:
```powershell
$env:SC_API_KEY="YOUR_WORKSPACE_KEY"
npm start
```

## Publishing behavior

The Publish button is a live action. It asks for confirmation, runs local validation, asks SocialClaw to validate the saved schedule, and only calls `socialclaw apply` if validation succeeds. The schedule is published as a whole; review every entry first.

## API endpoints

- `GET /api/health`
- `GET /api/accounts`
- `GET /api/schedule`
- `PUT /api/schedule`
- `POST /api/validate`
- `POST /api/publish`
- `GET /api/runs`
- `GET /api/runs/:id/status`
- `GET /api/posts`

## Before public deployment — important

This is a local/private starter, not production-hardened multi-user software. **Do not expose it to the public internet as-is.** Before deployment, add authentication and authorization, CSRF protection, rate limiting, audit logging, durable database storage, backups, and HTTPS. The schedule and run history are local JSON files and should be migrated to a database for multi-user use. SocialClaw account IDs and permissions remain controlled by your SocialClaw workspace.

## Security notes

- API keys are read only from server environment variables.
- CLI invocations use `spawn` with `shell: false`.
- Provider credentials are handled by SocialClaw, not this dashboard.
- Publishing requires explicit user action and successful validation.
- Platform content and API responses are untrusted data.
