import { withTransaction, query } from "../config/db";

export interface ConversationRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message_at: Date;
  created_at: Date;
}

export interface ConversationWithPreviewRow extends ConversationRow {
  buyer_name: string;
  seller_name: string;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

/** Idempotent: re-messaging the same seller reuses the existing thread. */
export async function findOrCreateConversation(
  buyerId: string,
  sellerId: string,
  productId: string | null
): Promise<ConversationRow> {
  const result = await query<ConversationRow>(
    `INSERT INTO conversations (buyer_id, seller_id, product_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (buyer_id, seller_id)
     DO UPDATE SET product_id = COALESCE(conversations.product_id, EXCLUDED.product_id)
     RETURNING id, buyer_id, seller_id, product_id, last_message_at, created_at`,
    [buyerId, sellerId, productId]
  );
  return result.rows[0];
}

export async function findConversationById(
  id: string,
  userId: string
): Promise<ConversationRow | null> {
  const result = await query<ConversationRow>(
    `SELECT id, buyer_id, seller_id, product_id, last_message_at, created_at
     FROM conversations WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function listConversationsForUser(userId: string): Promise<ConversationWithPreviewRow[]> {
  const result = await query<ConversationWithPreviewRow>(
    `SELECT c.id, c.buyer_id, c.seller_id, c.product_id, c.last_message_at, c.created_at,
            buyer.name AS buyer_name, seller.name AS seller_name,
            lm.body AS last_message_body, lm.sender_id AS last_message_sender_id,
            COALESCE(unread.count, 0)::int AS unread_count
     FROM conversations c
     JOIN users buyer ON buyer.id = c.buyer_id
     JOIN users seller ON seller.id = c.seller_id
     LEFT JOIN LATERAL (
       SELECT body, sender_id FROM messages
       WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
     ) lm ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM messages
       WHERE conversation_id = c.id AND sender_id != $1 AND read_at IS NULL
     ) unread ON true
     WHERE c.buyer_id = $1 OR c.seller_id = $1
     ORDER BY c.last_message_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const result = await query<MessageRow>(
    `SELECT id, conversation_id, sender_id, body, read_at, created_at
     FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<MessageRow> {
  return withTransaction(async (client) => {
    const result = await client.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, body, read_at, created_at`,
      [conversationId, senderId, body]
    );
    await client.query(`UPDATE conversations SET last_message_at = now() WHERE id = $1`, [conversationId]);
    return result.rows[0];
  });
}

export async function markMessagesRead(conversationId: string, readerId: string): Promise<void> {
  await query(
    `UPDATE messages SET read_at = now()
     WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [conversationId, readerId]
  );
}