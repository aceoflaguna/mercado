import { PoolClient } from "pg";
import { query } from "../config/db";

export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

export interface CartItemWithProduct extends CartItemRow {
  product_name: string;
  product_slug: string;
  price_cents: string;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  seller_id: string;
  seller_name: string;
}

export async function getCartForUser(userId: string): Promise<CartItemWithProduct[]> {
  const result = await query<CartItemWithProduct>(
    `SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
            p.name AS product_name, p.slug AS product_slug, p.price_cents,
            p.stock, p.image_url, p.is_active, p.seller_id, u.name AS seller_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     JOIN users u ON u.id = p.seller_id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function upsertCartItem(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartItemRow> {
  const result = await query<CartItemRow>(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()
     RETURNING id, user_id, product_id, quantity, created_at, updated_at`,
    [userId, productId, quantity]
  );
  return result.rows[0];
}

export async function setCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartItemRow | null> {
  const result = await query<CartItemRow>(
    `UPDATE cart_items SET quantity = $3, updated_at = now()
     WHERE user_id = $1 AND product_id = $2
     RETURNING id, user_id, product_id, quantity, created_at, updated_at`,
    [userId, productId, quantity]
  );
  return result.rows[0] ?? null;
}

export async function removeCartItem(userId: string, productId: string): Promise<boolean> {
  const result = await query(
    "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function clearCart(client: PoolClient, userId: string): Promise<void> {
  await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
}

export interface CartItemForCheckout extends CartItemWithProduct {
  seller_id: string;
}

/**
 * Locks the user's cart rows (FOR UPDATE) inside a transaction so concurrent
 * checkouts for the same cart can't both read stale quantities.
 */
export async function getCartForUserTx(
  client: PoolClient,
  userId: string
): Promise<CartItemForCheckout[]> {
  const result = await client.query<CartItemForCheckout>(
    `SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
            p.name AS product_name, p.slug AS product_slug, p.price_cents,
            p.stock, p.image_url, p.is_active, p.seller_id
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1
     FOR UPDATE OF ci`,
    [userId]
  );
  return result.rows;
}
