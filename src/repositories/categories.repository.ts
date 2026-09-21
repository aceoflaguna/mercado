import { query } from "../config/db";

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  created_at: Date;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const result = await query<CategoryRow>(
    "SELECT id, name, slug, created_at FROM categories ORDER BY name ASC"
  );
  return result.rows;
}

export async function createCategory(name: string, slug: string): Promise<CategoryRow> {
  const result = await query<CategoryRow>(
    "INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at",
    [name, slug]
  );
  return result.rows[0];
}

export async function findCategoryById(id: number): Promise<CategoryRow | null> {
  const result = await query<CategoryRow>(
    "SELECT id, name, slug, created_at FROM categories WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}
