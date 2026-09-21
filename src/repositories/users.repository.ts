import { query } from "../config/db";

export type UserRole = "buyer" | "seller" | "admin";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Omit<UserRow, "password_hash">;

export function toPublicUser(row: UserRow): PublicUser {
  const { password_hash: _passwordHash, ...publicUser } = row;
  return publicUser;
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
  role?: UserRole;
}): Promise<UserRow> {
  const { email, passwordHash, name, role = "buyer" } = params;
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password_hash, name, role, created_at, updated_at`,
    [email, passwordHash, name, role]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT id, email, password_hash, name, role, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT id, email, password_hash, name, role, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateUserRole(id: string, role: UserRole): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `UPDATE users SET role = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, email, password_hash, name, role, created_at, updated_at`,
    [id, role]
  );
  return result.rows[0] ?? null;
}
