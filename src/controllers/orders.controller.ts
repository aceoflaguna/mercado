import { Request, Response } from "express";
import { checkout, listOrdersForUser, findOrderById, listOrderItems } from "../repositories/orders.repository";
import { NotFoundError } from "../types/errors";

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
