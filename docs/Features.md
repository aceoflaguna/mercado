## Trust & discovery
- **Reviews & ratings** — buyers rate a product/seller after `completed` status. You already gate on order status for "mark delivered," so "can this buyer review" is the same check.
- **Seller storefront page** — the "Sold by X" link already lists a seller's products; a real storefront adds seller bio, join date, and aggregate rating once reviews exist.
- **Wishlist/favorites** — simple `favorites (user_id, product_id)` table, "save for later" from product detail or cart.
- **Multiple product images** — currently one `image_url` string; a real gallery needs an `product_images` table or a JSON array column.

## Commerce mechanics
- **Split checkout instead of hard block** — I mentioned this as an alternative when we added the single-seller restriction: instead of blocking a mixed cart, run `checkout()` once per seller and return N orders. Natural upgrade path from what's there now.
- **Discount codes/coupons** — `coupons` table + a discount field applied at checkout before the total is computed.
- **Back-in-stock notifications** — a buyer opts in on an out-of-stock product; a lightweight polling job or a check-on-restock trigger notifies them.
- **Tracking number on shipped orders** — small addition to the `ship` endpoint we already built (add a `tracking_number` column, surface it on order detail).

## Search & browse
- **Sort & filter** — sort by price/newest, filter by price range or "in stock only." The product list endpoint already supports pagination; this is additive query params.
- **Real full-text search** — there's already an unused `tsvector` GIN index on `products.name` in the schema from the very first build; currently search uses plain `ILIKE`. Wiring up `to_tsquery` would meaningfully improve relevance for longer product names.

## Seller tools
- **Seller analytics** — revenue over time, top products, using data that already exists in `order_items`/`orders` (the "Sold items" tab is basically the raw feed; analytics is aggregation on top of it).
- **Low-stock alerts** — flag in the seller dashboard when a listing drops below a threshold.
- **Admin panel UI** — right now promoting a category-creator/admin requires a direct SQL `UPDATE`. A real admin UI (manage users, force-cancel orders, moderate listings) would remove that manual step.

## Account & trust
- **Forgot-password flow** — currently password change requires being logged in; a true reset flow needs an email-sending step (token + expiry, similar shape to the `sessions` table pattern), which is a bigger addition since nothing in the stack sends email yet.
- **Email verification on signup** — same email-sending dependency as above; worth doing together if you add either.
- **Account lockout / login attempt tracking** — the login rate limiter is IP-based right now; per-account lockout after N failed attempts is a common escalation.

## PWA-specific
- **Push notifications** on order status changes (shipped/delivered/cancelled) — this is exactly what the PWA setup was built for; needs a push subscription table + web-push backend integration.
- **Order search/filter** in the buyer's own order list, useful once order history grows.

## My honest read on priority
If I had to pick where the *value per unit of effort* is highest right now: **sort/filter on browse**, **tracking numbers on shipped orders**, and **reviews & ratings** are all small, use data/endpoints you already have, and close real gaps a shopper would notice immediately. **Email-dependent stuff** (forgot-password, notifications) is the biggest lift since nothing in the stack sends email yet — worth bundling into one "add an email provider" piece of work rather than doing it twice.
