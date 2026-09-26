## Audit Logging — Technical Documentation

### Purpose

Every HTTP request to the API is recorded: who made it, what endpoint, what payload, and what happened. This exists for three practical reasons — tracing down "why did this order end up in this state," spotting abuse patterns (e.g. repeated failed logins from one IP), and giving admins visibility into what sellers/buyers are actually doing on the platform. It is **not** designed as a compliance-grade non-repudiation log (see Reliability Model below) — treat it as an operational/debugging tool, not a legal audit trail.

---

### Data Model

```sql
audit_logs (
  id            UUID PRIMARY KEY,
  user_id       UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  method        VARCHAR(10),      -- GET, POST, PATCH, etc.
  path          TEXT,             -- e.g. "/api/orders/abc123/cancel"
  status_code   INTEGER,          -- the response status actually sent
  request_body  JSONB NULL,       -- parsed body, redacted, or NULL if empty
  query_params  JSONB NULL,       -- parsed query string, redacted, or NULL if empty
  ip_address    TEXT,
  user_agent    TEXT,
  duration_ms   INTEGER,          -- wall-clock time from request start to response finish
  created_at    TIMESTAMPTZ
)
```

Design choices worth calling out:

- **`user_id` is nullable with `ON DELETE SET NULL`**, not `CASCADE`. Deleting a user does not erase their history from the log — the row survives as an anonymized entry. This is deliberate: the log's value as a record of *what happened* shouldn't disappear just because the actor's account later does.
- **Body and query params are `JSONB`**, not `TEXT`. This means the database can index into or query against payload contents later (`request_body->>'productId'`) without needing to `JSON.parse` every row client-side. Nothing currently does this, but the schema doesn't foreclose it.
- **No foreign key on `path`** — it's a free-text column, not normalized against a route table. Routes change over time; a historical log entry should reflect the literal path that was requested, not a lookup that could later go stale or be deleted.
- Three indexes exist: `user_id` (for "show me what user X did"), `created_at DESC` (for the default reverse-chronological listing), and `path` (for filtering by endpoint). There is deliberately no index on `status_code` or `method` — those are low-cardinality columns where a sequential scan over an already-filtered set is typically faster than an index lookup, and every extra index adds write overhead to a table that gets written on *every single request*.

---

### Architecture: Where Logging Happens

Logging is implemented as **Express middleware**, not scattered `insertAuditLog()` calls inside individual controllers. This is the central architectural decision:

```
Request → helmet → cors → express.json() → morgan → auditLog → routes → response
```

The middleware sits after `express.json()` (so `req.body` is already parsed into an object, not a raw buffer) and before the route handlers. This means it wraps **every** route automatically — a new endpoint gets audit logging for free, with zero code added at the route level. The alternative (a decorator or explicit call per controller) would require remembering to add it every time, and would inevitably get missed on some route eventually.

**The logging write is asynchronous and deferred to response completion**, not request start:

```js
res.on("finish", () => {
  insertAuditLog({ ... }).catch(err => console.error(...));
});
next();
```

`res.on("finish")` fires once Express has fully flushed the response to the client. This ordering matters for two reasons:

1. **The response status code is known.** Logging at request start would only capture "a request came in," not "here's what actually happened" — a 200 vs. a 500 vs. a 403 are meaningfully different events, and the status code isn't determined until the handler finishes.
2. **`req.user` is populated by then, if applicable.** Auth (`requireAuth`) runs as route-level middleware *after* this audit middleware in the chain, but by the time `finish` fires, the entire request lifecycle — including auth — has already completed. So even though `auditLog` itself runs before the auth check, reading `req.user?.sub` inside the `finish` callback reliably reflects the authenticated user, if any.

---

### Reliability Model: Fire-and-Forget

This is the most important tradeoff in the design, and it's intentional:

```js
insertAuditLog({...}).catch(err => console.error("Failed to write audit log:", err));
```

The insert's promise is never `await`-ed, and its rejection is swallowed (logged to stderr, not surfaced). Concretely, this means:

- **A slow database never adds latency to the API response.** The client already has their response before the log write even starts.
- **A failed log write can never turn into a 500 for the real request.** Logging is best-effort; the actual business operation (creating an order, updating a product) has already succeeded or failed independently of whether its log entry made it to disk.
- **Conversely: logging is not guaranteed.** If the process crashes between `res.on("finish")` firing and the `INSERT` completing, that entry is lost. If Postgres is briefly unreachable, that request goes unlogged with only a stderr line to show for it.

This is the correct tradeoff for an operational/debugging log, where "the app must never break because of logging" outranks "every single event must be captured." It would be the *wrong* tradeoff for something like financial transaction logging or legal audit trails, where you'd want the log write inside the same database transaction as the business operation (so either both commit or both roll back) — that's a meaningfully different and more invasive design, since it would need every controller to accept a shared transaction client rather than logging living entirely in middleware.

---

### Redaction

Request bodies are logged, but credentials aren't — a recursive denylist strips them before the row is ever written:

```js
const SENSITIVE_KEYS = new Set(["password", "currentPassword", "newPassword", "password_hash", "token"]);

function redact(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redact(val);
  }
  return result;
}
```

This walks the entire object graph recursively, so a sensitive field nested inside a larger payload is still caught — it isn't a shallow, top-level-only check. The tradeoff is that it's a **denylist keyed on field name**, not a schema-aware redaction. Two consequences follow directly from that:

- Adding a new sensitive field anywhere in the API (say, a future payment-details form) requires remembering to add its key name to `SENSITIVE_KEYS`. Nothing enforces this automatically — it's a manual step, and the single place in the codebase where it needs to happen.
- It redacts by key name regardless of endpoint. `password` is stripped everywhere it appears, even on an endpoint where it wouldn't actually be sensitive — an acceptable false positive, since over-redacting is the safe failure mode and under-redacting is not.

Query parameters go through the same `redact()` function, for the same reason — a credential could in principle be passed as a query string (bad practice, but not something the logger should assume never happens).

---

### What Gets Excluded

```js
const EXCLUDED_PATHS = new Set(["/api/health"]);
```

Health checks are typically polled every few seconds by uptime monitors and would otherwise dominate the table with zero investigative value. This is a simple exact-path denylist, checked before any other work happens in the middleware — an excluded path costs nothing beyond a single `Set.has()` call.

This is also the extension point if you later find another noisy, low-value route (e.g., if a frontend polling endpoint gets added) — add its path here rather than filtering it out at query time, since filtering at write time means the row is never even created.

---

### Access Control

The read side (`GET /api/audit-logs`) is gated by `requireRole("admin")`, applied at the router level:

```js
router.use(requireAuth, requireRole("admin"));
```

This means every route in `audit-logs.routes.ts` inherits the restriction — there's currently only one route, but any future addition to that router (e.g., a `DELETE` for manual purging, or a per-user export) is admin-only by default rather than by remembering to add the check each time.

Note the asymmetry: **writing** to the audit log happens for every request regardless of role (it's unconditional middleware), but **reading** it is admin-only. A buyer's own actions are logged just like anyone else's, but only an admin can query the log — including entries where `user_id` belongs to that same buyer. There's no self-service "see my own activity log" endpoint; that would be a straightforward addition (same query, filtered to `req.user.sub` server-side rather than accepting an arbitrary `userId`) if it's ever wanted.

---

### Query API

`GET /api/audit-logs` supports server-side filtering and pagination, mirroring the same pattern used elsewhere in the API (`listProducts`, `listAuditLogs` in `audit-logs.repository.ts`):

| Param | Behavior |
|---|---|
| `userId` | Exact match against `audit_logs.user_id` |
| `method` | Exact match, uppercased (`get` and `GET` both work) |
| `path` | `ILIKE '%value%'` — substring match, case-insensitive |
| `page` / `pageSize` | Standard offset pagination, same shape as products/orders endpoints |

Filters are built as a dynamic `WHERE` clause assembled from only the parameters actually present — an unfiltered request (`GET /api/audit-logs`) returns everything, newest first, paginated. This is the same conditional-WHERE-building pattern as `products.repository.ts`'s `listProducts`, for consistency across the codebase.

The response includes a `LEFT JOIN` to `users` so each row carries `user_email`/`user_name` directly, rather than requiring the client to make a second round-trip per row to resolve who `user_id` refers to. It's a `LEFT JOIN` specifically (not `INNER`) so that anonymous requests (`user_id IS NULL`) and requests from since-deleted users still appear in the result set, just with `user_email`/`user_name` coming back `NULL`.

---

### Frontend Viewer

The admin UI (`adminAuditLogsView`) is a straightforward filtered table: method dropdown, path substring search (debounced at 400ms so it doesn't fire a request per keystroke), and pagination — the same UI patterns already used on the product browse page. Two details worth noting:

- **Request/query bodies are hidden by default**, shown only on demand via a "Body" toggle button per row that reveals a collapsed `<pre>` block. This keeps the table scannable at a glance (dozens of rows visible at once) while still making full payload detail available a click away, rather than cramming JSON into every row unconditionally.
- **Status codes are color-coded** (`ok` / `client-error` / `server-error` bands) using a dedicated `.mc-http-status` class distinct from `.mc-order-status` — these represent different kinds of state (HTTP outcome vs. business-domain order lifecycle) and were kept as separate CSS concerns rather than reusing one class for both, even though they look visually similar.

---

### Known Limitations (by design, not oversight)

1. **No retention policy.** The table grows unboundedly — every request, forever. There's no scheduled cleanup. For any real deployment, this needs either a periodic `DELETE FROM audit_logs WHERE created_at < now() - interval 'N days'` job or table partitioning by month; neither exists yet.
2. **Not transactionally consistent with the operation it describes.** As covered above — a log entry can be lost, or (much less likely, but possible) written for an operation whose actual database transaction later rolled back due to an unrelated concurrent failure, since the two are entirely decoupled.
3. **GETs are logged with full query params**, which can make the table noisy on read-heavy endpoints like product browsing. Filtering GETs out entirely, or excluding specific high-traffic read paths, is a one-line change in the middleware if this becomes a problem in practice.
4. **Redaction is denylist-based**, not schema-derived — see the Redaction section above. It fails safe (over-redacts) but requires manual upkeep as the API grows.

---

Want me to save this as `mercado-api/docs/audit-logging.md` (or fold it into the existing README as a new section) so it lives with the code, rather than just staying here in chat?


---

# Additional (to do)

## Tier 1 — foundational (build these first)

**User management**
- List/search all users (email, name, role, join date)
- View a user's full activity: their orders (as buyer), listings (as seller), addresses
- Change role manually (promote/demote) — you already have `updateUserRole`, just needs an admin-facing route instead of only the self-service `become-seller` path
- **Suspend/ban** — this needs a new field. Right now `users.role` is `buyer|seller|admin`; a banned user shouldn't lose their role (you'd want to restore it later), so this should be a separate `is_suspended boolean` column, checked in `requireAuth` alongside the role lookup
- **Force logout** — you already have `deleteAllSessionsForUser` from the password-change work; just needs an admin route to call it on someone else's `userId`

**Order oversight**
- Right now there's no way to see *all* orders — buyers see their own, sellers see orders containing their products. Admin needs an unfiltered view: `listAllOrders()` with filters (status, date range, buyer, seller)
- Admin override actions: force-cancel any order (you already have `cancelOrder`, just needs an admin-authorized route bypassing the buyer/seller ownership check that already exists in `postCancelOrder`)

**Catalog moderation**
- View all products including inactive/soft-deleted ones (right now `listProducts` hardcodes `is_active = true`)
- Force-deactivate any listing regardless of owner (the ownership check in `patchProduct`/`removeProduct` already has an `admin` bypass — it just has no route surface yet)
- Category management beyond create: edit/delete/merge

Key design decisions worth flagging:
- **Append-only, never updated or deleted** — that's what makes it trustworthy as a record. No `updated_at`, no edit endpoint.
- **`before_state`/`after_state` as JSONB snapshots**, not just "what changed" — lets you reconstruct exactly what an order looked like before an admin force-cancelled it, without needing to reverse-engineer from a diff.
- Log **every admin action** at minimum (that's the trust-sensitive category), and optionally also seller actions on orders (ship/cancel) and buyer actions (mark delivered) if you want a full order timeline visible to support staff — not just "what did admins do" but "what happened to this order, by anyone."
- Practically, the cleanest way to wire this in is a small `logAction()` helper called explicitly at the end of each sensitive controller (cancel, role change, force-deactivate) rather than trying to hook it in generically — explicit call sites are easier to reason about than middleware magic, and you don't log noise like every product view.

## Tier 3 — useful but not urgent

- **Dashboard/analytics**: GMV, order counts by status, top sellers/products, signups over time — all read-only aggregate queries against tables you already have, no new schema needed
- **Session visibility**: you already have a `sessions` table — an admin view listing a user's active sessions (device/IP/last-seen) with per-session revoke, not just revoke-all
- **Reports/flagging**: if you ever want buyers to report a listing or seller, that's a new `reports` table — skip until you actually need moderation-by-report rather than admin-initiated moderation

## What I'd build first, concretely

Given what already exists in your codebase, the highest-leverage starting point is:
1. The `audit_log` table + `logAction()` helper
2. Admin routes for: list all users, change role, suspend/unsuspend, force-logout
3. Admin routes for: list all orders (with filters), force-cancel (logged)
4. Wire audit logging into the *existing* cancel/ship/role-change endpoints so you're not retrofitting it later once there's real data you'd want history for

That's a self-contained first slice — user + order oversight with a real audit trail — without yet building the catalog-moderation or analytics pieces, which can layer on afterward using the same patterns.

Want me to start with that slice (schema + audit helper + user/order admin routes), or would you rather begin somewhere else on this list?