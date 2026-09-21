import { PoolClient } from "pg";
import { query } from "../config/db";

export interface ProductRow {
  id: string;
  seller_id: string;
  category_id: number | null;
  name: string;
  slug: string;
  description: string;
  price_cents: string; // BIGINT comes back as string from pg
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ListProductsParams {
  search?: string;
  categoryId?: number;
  sellerId?: string;
  page: number;
  pageSize: number;
}

export async function listProducts(
  params: ListProductsParams
): Promise<{ items: ProductRow[]; total: number }> {
  const { search, categoryId, sellerId, page, pageSize } = params;
  const conditions: string[] = ["is_active = true"];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }
  if (categoryId !== undefined) {
    values.push(categoryId);
    conditions.push(`category_id = $${values.length}`);
  }
  if (sellerId) {
    values.push(sellerId);
    conditions.push(`seller_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM products ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  values.push(pageSize, (page - 1) * pageSize);
  const itemsResult = await query<ProductRow>(
    `SELECT id, seller_id, category_id, name, slug, description, price_cents,
            stock, image_url, is_active, created_at, updated_at
     FROM products
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { items: itemsResult.rows, total };
}

export async function findProductById(id: string): Promise<ProductRow | null> {
  const result = await query<ProductRow>(
    `SELECT id, seller_id, category_id, name, slug, description, price_cents,
            stock, image_url, is_active, created_at, updated_at
     FROM products WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findProductBySlug(slug: string): Promise<ProductRow | null> {
  const result = await query<ProductRow>(
    `SELECT id, seller_id, category_id, name, slug, description, price_cents,
            stock, image_url, is_active, created_at, updated_at
     FROM products WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ?? null;
}

export async function createProduct(params: {
  sellerId: string;
  categoryId: number | null;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
}): Promise<ProductRow> {
  const { sellerId, categoryId, name, slug, description, priceCents, stock, imageUrl } = params;
  const result = await query<ProductRow>(
    `INSERT INTO products (seller_id, category_id, name, slug, description, price_cents, stock, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, seller_id, category_id, name, slug, description, price_cents,
               stock, image_url, is_active, created_at, updated_at`,
    [sellerId, categoryId, name, slug, description, priceCents, stock, imageUrl]
  );
  return result.rows[0];
}

export async function updateProduct(
  id: string,
  sellerId: string,
  fields: Partial<{
    categoryId: number | null;
    name: string;
    description: string;
    priceCents: number;
    stock: number;
    imageUrl: string | null;
    isActive: boolean;
  }>
): Promise<ProductRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  const mapping: Record<string, unknown> = {
    category_id: fields.categoryId,
    name: fields.name,
    description: fields.description,
    price_cents: fields.priceCents,
    stock: fields.stock,
    image_url: fields.imageUrl,
    is_active: fields.isActive,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return findProductById(id);
  }

  setClauses.push("updated_at = now()");
  values.push(id, sellerId);

  const result = await query<ProductRow>(
    `UPDATE products SET ${setClauses.join(", ")}
     WHERE id = $${values.length - 1} AND seller_id = $${values.length}
     RETURNING id, seller_id, category_id, name, slug, description, price_cents,
               stock, image_url, is_active, created_at, updated_at`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteProduct(id: string, sellerId: string): Promise<boolean> {
  const result = await query(
    "UPDATE products SET is_active = false, updated_at = now() WHERE id = $1 AND seller_id = $2",
    [id, sellerId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Atomically decrement stock, but only if enough stock is available.
 * Returns the updated row, or null if there wasn't enough stock (caller
 * should treat that as a conflict). Must be called within a transaction
 * (pass the transaction's client) during checkout.
 */
export async function decrementStock(
  client: PoolClient,
  productId: string,
  quantity: number
): Promise<ProductRow | null> {
  const result = await client.query<ProductRow>(
    `UPDATE products
     SET stock = stock - $2, updated_at = now()
     WHERE id = $1 AND stock >= $2
     RETURNING id, seller_id, category_id, name, slug, description, price_cents,
               stock, image_url, is_active, created_at, updated_at`,
    [productId, quantity]
  );
  return result.rows[0] ?? null;
}
