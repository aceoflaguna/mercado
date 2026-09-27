import { query } from "../config/db";

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  position: number;
  created_at: Date;
}

export async function listImagesForProduct(productId: string): Promise<ProductImageRow[]> {
  const result = await query<ProductImageRow>(
    `SELECT id, product_id, url, position, created_at
     FROM product_images WHERE product_id = $1
     ORDER BY position ASC, created_at ASC`,
    [productId]
  );
  return result.rows;
}

const MAX_IMAGES_PER_PRODUCT = 8;

export async function countImagesForProduct(productId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM product_images WHERE product_id = $1`,
    [productId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function addProductImage(productId: string, url: string): Promise<ProductImageRow> {
  const count = await countImagesForProduct(productId);
  if (count >= MAX_IMAGES_PER_PRODUCT) {
    throw new Error(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
  }
  const result = await query<ProductImageRow>(
    `INSERT INTO product_images (product_id, url, position)
     VALUES ($1, $2, $3)
     RETURNING id, product_id, url, position, created_at`,
    [productId, url, count]
  );
  return result.rows[0];
}

export async function findImageById(id: string, productId: string): Promise<ProductImageRow | null> {
  const result = await query<ProductImageRow>(
    `SELECT id, product_id, url, position, created_at FROM product_images WHERE id = $1 AND product_id = $2`,
    [id, productId]
  );
  return result.rows[0] ?? null;
}

export async function deleteProductImage(id: string, productId: string): Promise<boolean> {
  const result = await query(`DELETE FROM product_images WHERE id = $1 AND product_id = $2`, [id, productId]);
  return (result.rowCount ?? 0) > 0;
}