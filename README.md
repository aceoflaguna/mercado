# Mercado API

An online marketplace API: buyers and sellers, product listings, cart, and checkout.
Express + TypeScript. **PostgreSQL with no ORM** (raw parameterized SQL via `pg`). **Argon2id**
for password hashing. **Email + password only** authentication (no OAuth/social login) with JWT
bearer tokens for sessions.

## Stack
- Express 4 + TypeScript (strict mode)
- PostgreSQL via `pg` — hand-written SQL in `src/repositories/`, no query builder or ORM
- `argon2` — Argon2id password hashing
- `jsonwebtoken` — stateless auth via signed JWTs
- `zod` — request validation
- nodemon + ts-node — dev hot-reload

## Data model
```
users        (id, email UNIQUE, password_hash, name, role: buyer|seller|admin)
categories   (id, name, slug)
products     (id, seller_id → users, category_id → categories, name, slug, price_cents, stock, is_active)
cart_items   (id, user_id → users, product_id → products, quantity) UNIQUE(user_id, product_id)
orders       (id, user_id → users, status, total_cents, shipping_address)
order_items  (id, order_id → orders, product_id, seller_id, product_name, unit_price_cents, quantity)
```
Money is stored as integer cents (`price_cents`, `total_cents`) to avoid floating-point rounding
errors — never store currency as `float`/`double`.

`order_items` snapshots the product name and price at time of purchase, so later edits to a
product (price change, rename, deletion) never rewrite historical orders.

## Getting started

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL, JWT_SECRET
npm run db:migrate          # creates tables (idempotent, safe to re-run)
npm run dev                 # http://localhost:3000, hot-reloads on save
```

`DATABASE_URL` example: `postgresql://mercado:yourpassword@localhost:5432/mercado_db`

### Roles & bootstrapping
Registration (`POST /api/auth/register`) only takes email/password/name and always creates a
**buyer**. There is no role picker at signup — that's intentional, matching "email + password
only" registration. Two upgrade paths exist:
- **Buyer → Seller**: self-service via `POST /api/auth/become-seller` (any logged-in buyer).
- **Admin**: no public endpoint promotes admins (by design — don't expose that). Bootstrap your
  first admin directly in the database:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
  ```
  Admins can create categories and manage any product.

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Dev server, nodemon + ts-node, hot-reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled JS (production) |
| `npm run db:migrate` | Apply `src/db/schema.sql` |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## API

All responses: `{ "status": "ok", "data": ... }` or `{ "status": "error", "message": "..." }`.
Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ email, password, name }` → user + JWT |
| POST | `/api/auth/login` | — | `{ email, password }` → user + JWT (rate-limited: 10/15min) |
| GET | `/api/auth/me` | ✅ | Current user |
| POST | `/api/auth/become-seller` | ✅ | Upgrade buyer → seller, returns fresh JWT |

### Categories
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/categories` | — | List all |
| POST | `/api/categories` | admin | `{ name }` |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/products?search=&categoryId=&page=&pageSize=` | — | Paginated list |
| GET | `/api/products/:id` | — | Single product |
| POST | `/api/products` | seller/admin | Create own listing |
| PATCH | `/api/products/:id` | owner/admin | Partial update |
| DELETE | `/api/products/:id` | owner/admin | Soft-delete (`is_active = false`) |

### Cart (per-user, all routes require auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/cart` | Current cart + total |
| POST | `/api/cart/items` | `{ productId, quantity }` — validated against live stock |
| PATCH | `/api/cart/items/:productId` | `{ quantity }` |
| DELETE | `/api/cart/items/:productId` | Remove item |

### Orders (auth required)
| Method | Path | Description |
|---|---|---|
| POST | `/api/orders/checkout` | `{ shippingAddress }` — turns cart into an order |
| GET | `/api/orders` | List own orders |
| GET | `/api/orders/:id` | One order + line items |

## Checkout: how stock safety works
Checkout (`src/repositories/orders.repository.ts`) runs as a single Postgres transaction:
1. Lock the user's cart rows (`SELECT ... FOR UPDATE`) so a concurrent checkout of the same cart
   can't read stale data.
2. Re-check every item is still active.
3. For each item, atomically decrement stock with `UPDATE products SET stock = stock - $qty
   WHERE id = $id AND stock >= $qty` — if that matches zero rows (not enough stock), the whole
   transaction throws and rolls back. No partial deductions, no half-created orders.
4. Snapshot price + product name into `order_items`.
5. Clear the cart.

This was tested directly: overselling (cart quantity exceeding live stock) returns `409` and
leaves stock, the cart, and the orders table completely untouched.

## Security notes
- Passwords: Argon2id, tuned via `ARGON2_*` env vars (raise `ARGON2_MEMORY_COST`/`TIME_COST` in
  production — current defaults are dev-friendly, not maximally hardened).
- Login is rate-limited (10 attempts / 15 min per IP) to slow credential stuffing.
- Login/register return the same generic "Invalid email or password" message — never reveal
  whether an email is registered.
- All SQL is parameterized (`$1, $2, ...`); no string concatenation into queries anywhere.
- Postgres error codes (unique/FK/check violations) are translated into clean 409/400 responses
  in `errorHandler.ts` instead of leaking raw DB errors.
- `helmet` for standard security headers, `cors` configurable via `CORS_ORIGIN`.

## What's intentionally out of scope
This covers the marketplace core (auth, catalog, cart, checkout) but not: payments/webhooks,
shipping/logistics integration, product reviews/ratings, seller payouts, image uploads (products
take an `imageUrl` string — wire up S3/Cloudinary/etc. separately), search relevance beyond
`ILIKE`/`ILIKE` (a `tsvector` index is already on `products.name` if you want to switch to
full-text search), and refresh tokens (JWTs are long-lived via `JWT_EXPIRES_IN`; add refresh
tokens if you need revocation).
