# Heart Memory, live arrival and room evolution

## Delivery and deployment

Implemented in the existing React/Supabase application. No Vercel deployment was performed. Migration 202609100006_heart_memories.sql was applied to the linked Supabase project (ctimhxkwpzsebodbtptx). The existing live website remains on its previous frontend until you deploy it.

No payment settings, receiver accounts, approval credentials, donation amounts, hatching totals or historical donations were changed. No real test donation was created. The migration adds read functions and change notifications; the previous API remains compatible.

## Added files

- src/components/HeartMemories.jsx — paginated explorer, safe memory detail card, original sharing/download action.
- src/components/AnimatedCount.jsx — bounded counter animation with reduced-motion support.
- src/components/RoomEvolution.jsx — accumulated environmental props and room progress/announcement.
- src/data/roomEvolution.js — independent stage helpers derived from existing milestones; shared special-heart ornaments.
- src/services/heartMemories.js — public memory projection, deterministic decorative IDs, session receipt deduplication.
- supabase/migrations/202609100006_heart_memories.sql — private approved projection, public bounded RPCs, correction notifications.
- tests/heart-memories.test.js — privacy, pagination, revocation, deterministic hearts, stages and session receipts.

## Changed files

- src/hooks/useCollection.jsx and src/services/collectionSync.js — existing single donation realtime channel now feeds a bounded sequential arrival queue and exact aggregate totals.
- src/services/donationService.js — bounded world snapshot and keyset memory reads; legacy local backend remains supported.
- src/App.jsx and src/components/World.jsx — interactive jar hearts, adaptive arrival cluster, no forced scroll or mobile room switch, room evolution and counter integration.
- src/components/Collections.jsx — Heart Memories tab and server-side supporter search.
- src/components/Memories.jsx — preserves personal badges and share cards, loads the bookmarked user's approved history on opening the book, with a paginated explorer for older records.
- src/components/Modal.jsx — Escape closes only the top dialog and restores focus into the parent dialog.
- src/styles/index.css — memory surfaces, touch targets, gardens, stage lighting, reduced-motion and hidden-tab styles. Original Grand Heart aura remains unchanged.
- package.json — test concurrency limited to two to avoid simultaneous PostgreSQL WASM instances exhausting RAM.
- tests/collection-sync.test.js — approval/snapshot concurrency regression.
- .gitignore — local-only browser test scripts/screenshots excluded. README.md and supabase/DEPLOYMENT.md link this guide.

## Data flow and privacy

Approved records already exist in heart_private.donations. Their createdAt is the approval/credit timestamp, reused as approvedAt; there is no per-heart database duplication. The new approved_memories view additionally requires the matching order to remain approved.

The anonymous browser receives an explicit whitelist through SECURITY DEFINER read functions with fixed search_path and restricted grants. Private tables/view remain inaccessible to browser roles. Hidden names/handles are masked in SQL and defensively in the UI; slip paths, audit entries, receiver details and admin identities are never returned. Public messages render as React text, including Thai, emoji and long messages.

heart_world returns exact SQL aggregates plus at most 24 recent records for each recipient and at most 100 explicitly requested active arrival IDs. The homepage does not fetch all history. Each jar renders at most 10 representative interactive hearts, identified as donationId-heart-N. All refer back to the original donation.

heart_memories returns 24 records per page with a timestamp + ID cursor, recipient/type filters, public supporter name/handle or exact ID search, and ascending/descending ordering. Pages replace the visible grid instead of growing unlimited DOM. Special hearts remain community milestone discoveries; the card shows which discovery a donation helped unlock. They are not purchasable donation types.

## Realtime lifecycle

The existing approved-heart-collection subscription remains the only donation subscription. INSERT on heart_collection_events signals a genuinely committed approval. The coordinator fetches the bounded snapshot and queues new approved records. It also handles an approval present in a live snapshot before its own websocket message arrives.

A receipt key uses donation ID + approval timestamp. It is stored in a module-level set and sessionStorage, covering duplicate messages, StrictMode, remounts and same-tab navigation. Initial hydration and reconnect/tab-return catchup do not create arrival events. Events older than listener readiness are silent. Once handled, an approval cannot enqueue again in that browser tab session.

The queue runs one visual arrival at a time: materialize/curved flight (up to five representative hearts with the exact +quantity), land after about 1.7 seconds, animate the counter, reveal crossed room stages and show their names. Each entry finishes in about 3.1 seconds. At most eight celebrations wait; excess burst entries reconcile silently so the site does not trap visitors in a long backlog. Totals stay exact. Shared special discoveries appear in the activity message after landing.

Hidden tabs clear the pending visual queue and reconcile silently when returning. Offscreen recipient rooms receive their totals and toast without moving the page or changing the chosen mobile tab. Reduced motion shortens arrival to a fade and removes environmental animation. Background CSS animations pause. No new audio or audio permission flow was added.

Changes/deletions to credited records, or order status changes, update the existing event row. UPDATE events cause a silent authoritative refresh, allowing counts/stages to decrease and removed memories to disappear. Initial pending-to-approved status changes do not emit an extra correction event because credit already emitted INSERT.

## Room evolution

Six stages use the existing milestone thresholds: 0, 500, 1,000, 2,000, 3,000 and 5,000. Each recipient uses only their own approved count. Gardens, window light, an alcove, library and sanctuary accumulate. Rose has pink flowers/moon accents; Praew has warm gold flowers/sun-star accents. Existing collectible item thresholds are unchanged. Shared Moon/Crystal/Angel/Eternal ornaments follow the original shared special-heart requirements.

A live 497 → 502 crosses 500 after landing, revealing the garden. Refreshing at 502 renders the garden without replaying its evolution. Multiple thresholds crossed by one donation are returned in order. Rabbit and alpaca still appear only after their respective hatching game completes; donations do not bypass that requirement.

## Local Admin Approve check

1. Run npm run dev with the existing Supabase environment below.
2. Open localhost:5173 in a viewer tab. Keep it visible. Open the existing admin approval route in a separate window: /adminpage-rose, /adminpage-praew or /adminpage-all.
3. Use a valid pending item and the normal evidence review/approval form. For synthetic data use a separate test Supabase project; the linked project accepts real donations.
4. Before approval, the memory is absent. After approval, the viewer sees one arrival, the exact new count, and any crossed room stages after landing.
5. Open Collection → Heart Memories or tap a jar heart. Check recipient/type/name filters, paging, full message, Escape and sharing.
6. Refresh the viewer. Counts and evolved room remain; no old arrival plays. Keep Rose selected while approving Praew: the selected mobile room must not change.

## Environment and verification

No new environment variables or Edge Function deployment are required. Continue using VITE_BACKEND=supabase, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Never use a service-role key in the frontend. New Supabase projects must apply all migrations, including 005 and 006, before running the updated frontend.

npm test: 71 tests passed after limiting test concurrency. npm run build: passed (existing single-bundle size warning remains). Headless Edge checks used intercepted test data, not real credits: mobile/desktop rendering, 497 → 502 arrival/evolution, duplicate event, offscreen recipient, memory dialog, nested Escape/focus, no horizontal overflow and no runtime exceptions. A separate read-only localhost check against the real Supabase project verified both RPCs and initial hydration without arrival replay. No end-to-end real-money approval was performed.
