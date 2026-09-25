import { PoolClient } from "pg";
import { query, withTransaction } from "../config/db";

export interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  full_address: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listAddressesForUser(userId: string): Promise<AddressRow[]> {
  const result = await query<AddressRow>(
    `SELECT id, user_id, label, full_address, is_default, created_at, updated_at
     FROM addresses WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function findAddressById(id: string, userId: string): Promise<AddressRow | null> {
  const result = await query<AddressRow>(
    `SELECT id, user_id, label, full_address, is_default, created_at, updated_at
     FROM addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function getDefaultAddress(userId: string): Promise<AddressRow | null> {
  const result = await query<AddressRow>(
    `SELECT id, user_id, label, full_address, is_default, created_at, updated_at
     FROM addresses WHERE user_id = $1 AND is_default = true`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/** Setting isDefault atomically unsets any previous default — the partial unique index backs this up. */
export async function createAddress(params: {
  userId: string;
  label: string;
  fullAddress: string;
  isDefault: boolean;
}): Promise<AddressRow> {
  const { userId, label, fullAddress, isDefault } = params;
  return withTransaction(async (client: PoolClient) => {
    if (isDefault) {
      await client.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
    }
    const result = await client.query<AddressRow>(
      `INSERT INTO addresses (user_id, label, full_address, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, label, full_address, is_default, created_at, updated_at`,
      [userId, label, fullAddress, isDefault]
    );
    return result.rows[0];
  });
}

export async function updateAddress(
  id: string,
  userId: string,
  fields: Partial<{ label: string; fullAddress: string; isDefault: boolean }>
): Promise<AddressRow | null> {
  return withTransaction(async (client: PoolClient) => {
    if (fields.isDefault) {
      await client.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    const mapping: Record<string, unknown> = {
      label: fields.label,
      full_address: fields.fullAddress,
      is_default: fields.isDefault,
    };
    for (const [column, value] of Object.entries(mapping)) {
      if (value !== undefined) {
        values.push(value);
        setClauses.push(`${column} = $${values.length}`);
      }
    }
    if (setClauses.length === 0) {
      const existing = await client.query<AddressRow>(
        `SELECT id, user_id, label, full_address, is_default, created_at, updated_at
         FROM addresses WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      return existing.rows[0] ?? null;
    }

    setClauses.push("updated_at = now()");
    values.push(id, userId);
    const result = await client.query<AddressRow>(
      `UPDATE addresses SET ${setClauses.join(", ")}
       WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING id, user_id, label, full_address, is_default, created_at, updated_at`,
      values
    );
    return result.rows[0] ?? null;
  });
}

export async function deleteAddress(id: string, userId: string): Promise<boolean> {
  const result = await query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (result.rowCount ?? 0) > 0;
}