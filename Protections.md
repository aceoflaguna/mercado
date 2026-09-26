# Is the server protected on sql injection?

Yes — every query across the backend uses parameterized queries via `pg`, and none of them string-concatenate user input into SQL. That's the actual mechanism that prevents SQL injection (not something bolted on separately), so it's been true since the very first `users.repository.ts` was written, not something added later.

## The pattern used everywhere

```ts
await query(`SELECT * FROM users WHERE email = $1`, [email]);
```

`$1` is a placeholder resolved by the Postgres wire protocol itself — `email` is sent as a separate parameter, never substituted into the SQL text. Even if someone submits `email = "x' OR '1'='1"`, it's bound as a literal string value to compare against, not parsed as SQL syntax. This is true for every repository file: users, categories, products, cart, orders, addresses, sessions.

## The one pattern worth understanding (not a vulnerability, just easy to misread)

A few places — `listProducts`, `updateProduct`, `updateAddress` — build the SQL string dynamically, e.g.:

```ts
values.push(`%${search}%`);
conditions.push(`name ILIKE $${values.length}`);
```

At a glance this looks like string interpolation of user input. It isn't: `${values.length}` is a **placeholder index** (just a number the code computed, e.g. `$1`, `$2`), not the search term itself. The actual search text always travels through the `values` array and gets bound as a parameter. Same logic in `updateProduct`/`updateAddress`'s dynamic `SET` clauses — the *column names* come from a hardcoded `mapping` object (`{ name: ..., stock: ..., price_cents: ... }`), never from a user-supplied string, and the *values* are always parameterized. That distinction — dynamic **placeholder count**, hardcoded **column names**, parameterized **values** — is what makes it safe despite looking like string-building.

## What this doesn't cover (things to watch going forward)

- **Column/identifier injection**: Postgres placeholders (`$1`) can only bind *values*, not identifiers like column or table names. Every `ORDER BY` in this app is currently hardcoded (`ORDER BY created_at DESC`) — safe. But if you ever add a "sort by" feature driven by client input (`?sortBy=price`), don't splice that string into the query directly. Validate it against an allow-list first:
  ```ts
  const ALLOWED_SORT = { price: "price_cents", newest: "created_at" };
  const column = ALLOWED_SORT[sortBy] ?? "created_at"; // never trust the raw string
  ```
- **This app doesn't use `pool.query` with template-literal SQL anywhere** (i.e. no `` query(`WHERE email = '${email}'`) ``-style code exists) — that's the actual footgun to avoid if you or anyone else adds new queries by hand later. The rule of thumb: if a value ever appears inside the backtick-quoted SQL string itself rather than in the parameter array, stop and fix it before shipping.

---
