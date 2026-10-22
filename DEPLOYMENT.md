# Deployment checklist

## Recommended private deployment

1. Use a Node.js 20+ host with persistent storage.
2. Configure `SC_API_KEY` as a server-side secret/environment variable.
3. Install `socialclaw@0.1.12` in the runtime environment and verify the CLI is on PATH.
4. Run `npm install --omit=dev` and `npm start`.
5. Ensure the `data/` directory is persistent and writable.
6. Restrict access behind authentication or a private VPN.
7. Use HTTPS and review logs for accidental secret exposure.

## Do not deploy publicly without

- Login and server-side authorization
- CSRF protection and rate limits
- Durable database and backups
- Per-user workspace isolation
- Audit trail and explicit publish approval
- Monitoring and error reporting

This project does not include a production identity system, cloud database, or a configured hosted URL. No deployment or external account connection has been performed by generating these files.
