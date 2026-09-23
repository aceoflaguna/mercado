import { Request, Response } from "express";
import {
  checkout,
  listOrdersForUser,
  findOrderById,
  findOrderByIdAny,
  listOrderItems,
  listPendingOrdersForSeller,
  listOrderItemsForSeller,
  markOrderCompleted,
  listSoldItemsForSeller,
  cancelOrder,
} from "../repositories/orders.repository";
import { NotFoundError, ConflictError, ForbiddenError } from "../types/errors";


export async function postCheckout(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const { shippingAddress } = req.body as { shippingAddress: string };

  const order = await checkout(userId, shippingAddress);
  const items = await listOrderItems(order.id);

  res.status(201).json({ status: "ok", data: { ...order, items } });
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  const orders = await listOrdersForUser(req.user!.sub);
  res.status(200).json({ status: "ok", data: orders });
}

export async function getOrderById(req: Request, res: Response): Promise<void> {
  const order = await findOrderById(req.params.id, req.user!.sub);
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  const items = await listOrderItems(order.id);
  res.status(200).json({ status: "ok", data: { ...order, items } });
}

export async function getSellerPendingOrders(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const orders = await listPendingOrdersForSeller(sellerId);

  const withItems = await Promise.all(
    orders.map(async (order) => {
      const items = await listOrderItemsForSeller(order.id, sellerId);
      const sellerSubtotalCents = items
        .reduce((sum, item) => sum + BigInt(item.unit_price_cents) * BigInt(item.quantity), 0n)
        .toString();
      return { ...order, items, sellerSubtotalCents };
    })
  );

  res.status(200).json({ status: "ok", data: withItems });
}

export async function patchOrderStatus(req: Request, res: Response): Promise<void> {
  const updated = await markOrderCompleted(req.params.id, req.user!.sub);
  if (!updated) {
    throw new ConflictError("Order not found, or already completed/cancelled");
  }
  res.status(200).json({ status: "ok", data: updated });
}

export async function getSellerSoldItems(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const items = await listSoldItemsForSeller(sellerId);
  res.status(200).json({ status: "ok", data: items });
}

export async function postCancelOrder(req: Request, res: Response): Promise<void> {
  const order = await findOrderByIdAny(req.params.id);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const isOwner = order.user_id === req.user!.sub;
  const isAdmin = req.user!.role === "admin";

  let isSellerOnOrder = false;
  if (!isOwner && !isAdmin && req.user!.role === "seller") {
    const items = await listOrderItems(order.id);
    isSellerOnOrder = items.some((item) => item.seller_id === req.user!.sub);
  }

  if (!isOwner && !isAdmin && !isSellerOnOrder) {
    throw new ForbiddenError("You are not part of this order");
  }

  const cancelled = await cancelOrder(order.id);
  res.status(200).json({ status: "ok", data: cancelled });
}