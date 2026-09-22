import { PoolClient } from "pg";
import { query, withTransaction } from "../config/db";
import { getCartForUserTx, clearCart } from "./cart.repository";
import { decrementStock } from "./products.repository";
import { BadRequestError, ConflictError } from "../types/errors";

export interface OrderRow {
  id: string;
  user_id: string;
  status: string;
  total_cents: string;
  shipping_address: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  seller_id: string;
  product_name: string;
  unit_price_cents: string;
  quantity: number;
}

/**
 * Checkout: turns the user's current cart into an order.
 * Runs entirely inside one transaction:
 *   1. Lock the cart rows and re-read current stock/prices (never trust the client).
 *   2. Decrement stock per item, failing the whole transaction if any item is out of stock.
 *   3. Create the order + order_items (price snapshotted at purchase time).
 *   4. Clear the cart.
 * Any failure rolls back everything — no partial stock deductions or half-created orders.
 */
export async function checkout(userId: string, shippingAddress: string): Promise<OrderRow> {
  return withTransaction(async (client: PoolClient) => {
    const cartItems = await getCartForUserTx(client, userId);

    if (cartItems.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

    const inactiveItem = cartItems.find((item) => !item.is_active);
    if (inactiveItem) {
      throw new ConflictError(`Product "${inactiveItem.product_name}" is no longer available`);
    }

    let totalCents = 0n;
    for (const item of cartItems) {
      totalCents += BigInt(item.price_cents) * BigInt(item.quantity);
    }

    const orderResult = await client.query<OrderRow>(
      `INSERT INTO orders (user_id, status, total_cents, shipping_address)
       VALUES ($1, 'pending', $2, $3)
       RETURNING id, user_id, status, total_cents, shipping_address, created_at, updated_at`,
      [userId, totalCents.toString(), shippingAddress]
    );
    const order = orderResult.rows[0];

    for (const item of cartItems) {
      const updatedProduct = await decrementStock(client, item.product_id, item.quantity);
      if (!updatedProduct) {
        // Not enough stock — throwing here rolls back the whole transaction,
        // including any stock already decremented earlier in this loop.
        throw new ConflictError(
          `Insufficient stock for "${item.product_name}" (only ${item.stock} left)`
        );
      }

      await client.query(
        `INSERT INTO order_items (order_id, product_id, seller_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.product_id, item.seller_id, item.product_name, item.price_cents, item.quantity]
      );
    }

    await clearCart(client, userId);

    return order;
  });
}

export async function listOrdersForUser(userId: string): Promise<OrderRow[]> {
  const result = await query<OrderRow>(
    `SELECT id, user_id, status, total_cents, shipping_address, created_at, updated_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function findOrderById(orderId: string, userId: string): Promise<OrderRow | null> {
  const result = await query<OrderRow>(
    `SELECT id, user_id, status, total_cents, shipping_address, created_at, updated_at
     FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  return result.rows[0] ?? null;
}

export async function listOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const result = await query<OrderItemRow>(
    `SELECT id, order_id, product_id, seller_id, product_name, unit_price_cents, quantity
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  return result.rows;
}

/** Orders containing at least one item from this seller, still unfulfilled. */
export async function listPendingOrdersForSeller(sellerId: string): Promise<OrderRow[]> {
  const result = await query<OrderRow>(
    `SELECT DISTINCT o.id, o.user_id, o.status, o.total_cents, o.shipping_address, o.created_at, o.updated_at
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.seller_id = $1 AND o.status = 'pending'
     ORDER BY o.created_at DESC`,
    [sellerId]
  );
  return result.rows;
}

/** Line items within one order that belong to this seller (orders can span multiple sellers). */
export async function listOrderItemsForSeller(
  orderId: string,
  sellerId: string
): Promise<OrderItemRow[]> {
  const result = await query<OrderItemRow>(
    `SELECT id, order_id, product_id, seller_id, product_name, unit_price_cents, quantity
     FROM order_items WHERE order_id = $1 AND seller_id = $2`,
    [orderId, sellerId]
  );
  return result.rows;
}

/** Buyer confirms delivery. No-ops (returns null) if not their order, or already completed/cancelled. */
export async function markOrderCompleted(orderId: string, userId: string): Promise<OrderRow | null> {
  const result = await query<OrderRow>(
    `UPDATE orders SET status = 'completed', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status NOT IN ('completed', 'cancelled')
     RETURNING id, user_id, status, total_cents, shipping_address, created_at, updated_at`,
    [orderId, userId]
  );
  return result.rows[0] ?? null;
}

export interface SoldItemRow extends OrderItemRow {
  order_created_at: Date;
  order_status: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
}

/**
 * Every line item this seller has sold, with buyer + order context.
 * Excludes cancelled orders — a cancelled order was never really "sold".
 */
export async function listSoldItemsForSeller(sellerId: string): Promise<SoldItemRow[]> {
  const result = await query<SoldItemRow>(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.seller_id, oi.product_name,
            oi.unit_price_cents, oi.quantity,
            o.created_at AS order_created_at, o.status AS order_status,
            u.id AS buyer_id, u.name AS buyer_name, u.email AS buyer_email
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN users u ON u.id = o.user_id
     WHERE oi.seller_id = $1 AND o.status != 'cancelled'
     ORDER BY o.created_at DESC`,
    [sellerId]
  );
  return result.rows;
}
