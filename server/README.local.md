# Heart Collection

React + Vite frontend with a Node 24 backend and a central SQLite database. Real receiving is **off by default**. Demo donations and localStorage approvals are no longer used for public totals.

## Run

Requires Node 24. Install with npm install. Copy .env.example to .env and run these in separate terminals:

    npm run server
    npm run dev

Set APP_ORIGIN to the exact frontend URL printed by Vite (default http://localhost:5173). An origin mismatch blocks every write, including login. The Vite proxy sends /api to port 3001.

    npm test
    npm run build

For a built local site, set APP_ORIGIN=http://localhost:3001 then run npm start and open that URL.

## Receiving lock

The server refuses uploads, external donation credits, and manual approvals until all of these are configured:

- Separate Rose and Praew bank codes, bank names, account holder names and account numbers.
- EASYSLIP_API_KEY is optional for manual receiving; required only when enabling automatic verification.
- ADMIN_USERNAME and a unique ADMIN_PASSWORD of at least 16 characters.
- APP_ORIGIN (HTTPS is required with NODE_ENV=production).
- RECEIVING_ENABLED=true, explicitly set after checking the configuration.

While locked, the public API hides receiving accounts and checkout displays a closed message. The admin panel displays missing settings. There are no account numbers, API keys or administrator passwords supplied by this repository. Completeness checks do not establish account ownership: verify both destination accounts before enabling receiving. Verify provider entitlements before enabling automatic verification. Manual review does not require an EasySlip API key. Automatic verification requires a key and explicit admin activation with a shared call ceiling and expiry. Changing .env requires restarting the server.

**No deployment or live-money test has been performed. Leave RECEIVING_ENABLED=false until setup and acceptance testing are complete.**

## Payment and review

The supporter chooses Rose or Praew, a fixed-price heart and quantity (1–100), then uploads PNG/JPEG up to 4 MB. The server calculates the price and snapshots the destination account and review mode. File signatures and request size are checked. Slips are stored privately in SQLite and are served only to authenticated admins.

Modes are independent per recipient and default to manual. Automatic mode calls [EasySlip image verification](https://document.easyslip.com/en/v1/verify/bank/image) on the server. The adapter requires the expected THB amount, TH country, bank code, exact unmasked account number, transaction reference, and a transfer within the last seven days. Masked or unavailable destination information and provider failures remain pending. Clear mismatches and duplicate results are rejected. A provider error never creates hearts.

An admin can inspect the slip and approve a pending order after entering the bank transaction reference, actual incoming amount, destination bank code/account, transfer time, reason, and confirming receipt in the bank account. Rejection is terminal. Changing review mode does not process existing orders. Orders saved before a verifier timeout or server restart remain available for manual review.

The external donation form records transfers received through LINE, Facebook, Instagram or Other. The authenticated admin enters the recipient, donor, heart allocation, exact amount, transfer time and unique bank reference, and confirms checking the actual account. This path creates an approved record in one database transaction; it does not claim that a slip was verified by the API. External image attachments are not required; the website checkout supports image upload.

## Data and security

- One server instance and one persistent local SQLite database shared by all clients; WAL, unique slip hashes and bank references, and atomic credit/audit writes prevent double credit.
- Retries with the same request ID and content return the original order. Reusing an ID with changed content returns a conflict. Different photos of the same slip still require the same unique transaction reference.
- Admin password comparisons use scrypt and timing-safe comparison. Session cookies are HttpOnly and SameSite=Strict, expire after eight hours, and are Secure in production. Session tokens are hashed in the database. Every service restart revokes existing sessions, including after a password change.
- Mutation requests require exact APP_ORIGIN; authenticated routes protect queues, slips, modes and approvals. Login/upload rate limits persist in the database. Proxy forwarding headers are deliberately not trusted; behind a proxy this conservatively shares one IP limit.
- Public data contains approved donation stories only, no slip, bank details, admin identity, audit notes or bank transaction references. Anonymous names and social handles are discarded on the server. Messages are public.
- Totals refresh every five seconds and after window focus. The first load does not replay old arrivals.
- My Memories uses browser-local order bookmarks, not authenticated supporter identity. It never claims other visitors' gifts. Old browser demo data is not imported.
- Uploaded images are served with a fixed raster content type and nosniff, never as HTML or SVG. The backend serves only dist as public static files.

## Hosting and operations

Use a long-running Node 24 host with HTTPS reverse proxy and a **persistent volume** for DATABASE_PATH. Build the frontend, set NODE_ENV=production and the public HTTPS APP_ORIGIN, and run npm start. Set HOST=0.0.0.0 only when required by the host, behind its HTTPS proxy. Run one service instance; this SQLite design is not a multi-instance distributed database. Do not deploy this backend to Vercel's ephemeral function filesystem. The old Vercel static config does not provide a working backend.

Back up the SQLite database with SQLite's online backup facility, or stop the process before copying the database and any WAL/SHM files. Restrict volume access to the service operator. Establish a slip retention/deletion policy and secure backups before receiving personal data at scale. Never put .env, database files, slips or backups in public or dist.

To revoke all sessions after a credential change, restart the service. No unauthenticated setup or account editing endpoint is provided.

## Acceptance checks

npm test checks disabled receiving, authentication, origin checks, private slips, server prices, recipient isolation, manual and auto paths, fallback, duplicate references/images, idempotent retries, rollback, external donations, persistence and public data filtering using temporary databases and a mocked verifier. Tests do not contact EasySlip or accept real funds. A live provider check with the actual merchant settings is still required before enabling.

## Automatic verification controls

Open Admin > ควบคุมตรวจสลิปอัตโนมัติ. New databases start with manual modes, automatic verification off, and a zero budget. Existing databases receive a disabled policy on upgrade; previously selected auto modes cannot call the provider until an admin enables this policy.

1. Configure the server-only EasySlip key if automatic checks are wanted.
2. Check the provider account's remaining allowance and expiry.
3. Enter the cumulative call ceiling and expiry in Admin, then enable the shared switch.
4. Select automatic mode independently for Rose and/or Praew.

Every automatic call is subject to the shared ceiling, including ordinary automatic mode. There is no unlimited mode. For example, after 10 calls, a ceiling of 50 permits at most 40 further attempts across both recipients. The site does not query provider entitlements: subtract usage from other applications and leave a margin.

Call reservations and order insertion commit atomically. Failed attempts count; retries of a saved order do not call the provider again. At the ceiling, expiry, missing key, or provider failure, new orders remain pending for manual review. Provider failures also turn off the shared switch. Amount/account mismatches remain rejected; unclear verification remains pending.

Usage never resets on its own, on restart, or on API key changes. To start a new allowance, verify the entitlement and explicitly raise the cumulative ceiling and set a new expiry, then enable again. All policy changes and automatic pauses are audited. Turning off prevents new calls; already dispatched requests may still finish and approve their associated orders. Existing pending orders are never automatically replayed when enabling.

These changes apply to the existing Node/SQLite backend. Supabase migration and live provider/account configuration have not been performed. Receiving remains off unless RECEIVING_ENABLED is explicitly enabled after completing account/admin settings.
