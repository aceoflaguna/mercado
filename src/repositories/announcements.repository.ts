import { query } from "../config/db";

export interface AnnouncementRow {
  id: string;
  author_id: string;
  title: string;
  body: string;
  is_published: boolean;
  is_pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AnnouncementWithAuthorRow extends AnnouncementRow {
  author_name: string;
}

const LIST_COLUMNS = `
  a.id, a.author_id, u.name AS author_name, a.title, a.body,
  a.is_published, a.is_pinned, a.created_at, a.updated_at
`;

export async function listPublishedAnnouncements(
  page: number,
  pageSize: number
): Promise<{ items: AnnouncementWithAuthorRow[]; total: number }> {
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM announcements WHERE is_published = true`
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const itemsResult = await query<AnnouncementWithAuthorRow>(
    `SELECT ${LIST_COLUMNS}
     FROM announcements a JOIN users u ON u.id = a.author_id
     WHERE a.is_published = true
     ORDER BY a.is_pinned DESC, a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize]
  );
  return { items: itemsResult.rows, total };
}

export async function findPublishedAnnouncementById(
  id: string
): Promise<AnnouncementWithAuthorRow | null> {
  const result = await query<AnnouncementWithAuthorRow>(
    `SELECT ${LIST_COLUMNS}
     FROM announcements a JOIN users u ON u.id = a.author_id
     WHERE a.id = $1 AND a.is_published = true`,
    [id]
  );
  return result.rows[0] ?? null;
}

// --- Admin (sees drafts too) ---

export async function listAllAnnouncements(
  page: number,
  pageSize: number
): Promise<{ items: AnnouncementWithAuthorRow[]; total: number }> {
  const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM announcements`);
  const total = Number(countResult.rows[0]?.count ?? 0);

  const itemsResult = await query<AnnouncementWithAuthorRow>(
    `SELECT ${LIST_COLUMNS}
     FROM announcements a JOIN users u ON u.id = a.author_id
     ORDER BY a.is_pinned DESC, a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize]
  );
  return { items: itemsResult.rows, total };
}

export async function findAnnouncementByIdAny(id: string): Promise<AnnouncementWithAuthorRow | null> {
  const result = await query<AnnouncementWithAuthorRow>(
    `SELECT ${LIST_COLUMNS} FROM announcements a JOIN users u ON u.id = a.author_id WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createAnnouncement(params: {
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean;
  isPublished: boolean;
}): Promise<AnnouncementRow> {
  const { authorId, title, body, isPinned, isPublished } = params;
  const result = await query<AnnouncementRow>(
    `INSERT INTO announcements (author_id, title, body, is_pinned, is_published)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, author_id, title, body, is_published, is_pinned, created_at, updated_at`,
    [authorId, title, body, isPinned, isPublished]
  );
  return result.rows[0];
}

export async function updateAnnouncement(
  id: string,
  fields: Partial<{ title: string; body: string; isPinned: boolean; isPublished: boolean }>
): Promise<AnnouncementRow | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  const mapping: Record<string, unknown> = {
    title: fields.title,
    body: fields.body,
    is_pinned: fields.isPinned,
    is_published: fields.isPublished,
  };
  for (const [column, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findAnnouncementByIdAny(id);

  setClauses.push("updated_at = now()");
  values.push(id);
  const result = await query<AnnouncementRow>(
    `UPDATE announcements SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING id, author_id, title, body, is_published, is_pinned, created_at, updated_at`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM announcements WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}