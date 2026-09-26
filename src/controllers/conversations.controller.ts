import { Request, Response } from "express";
import {
  findOrCreateConversation,
  findConversationById,
  listConversationsForUser,
  listMessages,
  createMessage,
  markMessagesRead,
} from "../repositories/conversations.repository";
import { findOrderByIdAny, listOrderItems } from "../repositories/orders.repository";
import { BadRequestError, NotFoundError, ForbiddenError } from "../types/errors";

export async function postStartConversation(req: Request, res: Response): Promise<void> {
  const buyerId = req.user!.sub;
  const { sellerId, productId } = req.body as { sellerId: string; productId?: string | null };

  if (sellerId === buyerId) {
    throw new BadRequestError("You can't message yourself");
  }

  const conversation = await findOrCreateConversation(buyerId, sellerId, productId ?? null);
  res.status(200).json({ status: "ok", data: conversation });
}

/** Seller-initiated: reach out to the buyer on one of their own pending orders. */
export async function postStartConversationFromOrder(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const order = await findOrderByIdAny(req.params.orderId);
  if (!order) throw new NotFoundError("Order not found");

  const items = await listOrderItems(order.id);
  const sellerItem = items.find((item) => item.seller_id === sellerId);
  if (!sellerItem) throw new ForbiddenError("You are not a seller on this order");

  const conversation = await findOrCreateConversation(order.user_id, sellerId, sellerItem.product_id);
  res.status(200).json({ status: "ok", data: conversation });
}

export async function getConversations(req: Request, res: Response): Promise<void> {
  const conversations = await listConversationsForUser(req.user!.sub);
  res.status(200).json({ status: "ok", data: conversations });
}

export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  const conversation = await findConversationById(req.params.id, req.user!.sub);
  if (!conversation) throw new NotFoundError("Conversation not found");

  const messages = await listMessages(conversation.id);
  await markMessagesRead(conversation.id, req.user!.sub);
  res.status(200).json({ status: "ok", data: messages });
}

export async function postConversationMessage(req: Request, res: Response): Promise<void> {
  const conversation = await findConversationById(req.params.id, req.user!.sub);
  if (!conversation) throw new NotFoundError("Conversation not found");

  const { body } = req.body as { body: string };
  const message = await createMessage(conversation.id, req.user!.sub, body);
  res.status(201).json({ status: "ok", data: message });
}