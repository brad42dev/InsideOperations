---
id: DD-14-003
title: Implement round transfer API endpoint and transfer request UI
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When an operator needs to take over a round already locked to another user, they should be able to request a transfer. The current owner is notified; if they do not acknowledge within 1 minute, the round is automatically transferred to the requester. Managers and supervisors can override immediately without waiting. The requester sees a pending transfer state with a countdown. The current RoundPlayer shows a banner if another user has requested a transfer.

## Spec Excerpt (verbatim)

> **When a user starts a round, it locks to that user**. No one else can enter data.
> **Transfer mechanisms**:
> - Manager/supervisor override — immediate transfer
> - Notification to current owner → **1 minute no-acknowledgment → auto-transfer** to requesting user
> — 14_ROUNDS_MODULE.md, §Locking and Transfer

> `POST /api/rounds/instances/:id/transfer` — Request transfer
> — 14_ROUNDS_MODULE.md, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `frontend/src/api/rounds.ts` — all API methods defined here; `transferInstance` is absent
- `frontend/src/pages/rounds/RoundPlayer.tsx` — where the "Request Transfer" button must appear when the round is locked to another user; and where the "Transfer Requested" banner appears for the current owner
- `frontend/src/pages/rounds/index.tsx` / `ActiveRounds.tsx` — in-progress instance cards; transfer request should also be accessible from here

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `roundsApi.transferInstance(id)` exists in api/rounds.ts calling `POST /api/rounds/instances/:id/transfer`
- [ ] RoundPlayer checks if the instance's `locked_to_user` differs from the current user — if so, shows "Request Transfer" button
- [ ] Clicking "Request Transfer" calls `roundsApi.transferInstance(id)` and shows a pending state with estimated wait time
- [ ] RoundPlayer polls or uses WebSocket to detect when the transfer is granted and the round becomes accessible
- [ ] The current owner sees a "Transfer Requested" banner with Acknowledge/Decline actions

## Assessment

- **Status**: ❌ Missing — `transferInstance` is absent from api/rounds.ts; no transfer UI in RoundPlayer.tsx; `transferred` status is only shown as a display badge (index.tsx:37, RoundHistory.tsx:9) with no action

## Fix Instructions (if needed)

1. **Add API method** to `frontend/src/api/rounds.ts` after `startInstance` (line 184):
   ```ts
   transferInstance: (id: string): Promise<ApiResult<RoundInstance>> =>
     api.post<RoundInstance>(`/api/rounds/instances/${id}/transfer`, {}),

   acceptTransfer: (id: string): Promise<ApiResult<RoundInstance>> =>
     api.post<RoundInstance>(`/api/rounds/instances/${id}/transfer/accept`, {}),

   declineTransfer: (id: string): Promise<ApiResult<RoundInstance>> =>
     api.post<RoundInstance>(`/api/rounds/instances/${id}/transfer/decline`, {}),
   ```

2. **RoundPlayer.tsx** — after loading `detailResult`, compare `detailResult.data.locked_to_user` with `userId` (already available at line 410):
   - If `locked_to_user !== userId` and status is `in_progress`: render a "This round is locked to another user" banner with a "Request Transfer" button
   - If transfer is pending (new state returned by API): show "Transfer pending — auto-transfers in X seconds" countdown
   - If `locked_to_user === userId` and there is an incoming transfer request on the instance: show "Transfer requested by [user]" banner with Accept / Decline buttons

3. **Poll for transfer status** — after requesting transfer, use a `refetchInterval: 10_000` on the getInstance query so the player detects when the round is transferred to the requester.

4. The 1-minute auto-transfer countdown is server-managed — the frontend only needs to poll and react when the instance status changes.

Do NOT:
- Implement the 1-minute auto-transfer countdown in frontend JavaScript — the server enforces this
- Show the transfer UI when the round is `completed` or `missed`
- Allow transfer requests when the user does not have `rounds:execute` permission
