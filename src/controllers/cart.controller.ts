import { Request, Response } from "express";
import {
  getCartForUser,
  upsertCartItem,
  setCartItemQuantity,
  removeCartItem,
} from "../repositories/cart.repository";
import { findProductById } from "../repositories/products.repository";
import { NotFoundError, BadRequestError } from "../types/errors";

export async function getCart(req: Request, res: Response): Promise<void> {
  const items = await getCartForUser(req.user!.sub);
  const totalCents = items.reduce(
    (sum, item) => sum + BigInt(item.price_cents) * BigInt(item.quantity),
    0n
  );
  res.status(200).json({ status: "ok", data: { items, totalCents: totalCents.toString() } });
}

export async function postCartItem(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const { productId, quantity } = req.body as { productId: string; quantity: number };

  const product = await findProductById(productId);
  if (!product || !product.is_active) {
    throw new NotFoundError("Product not found");
  }
  if (product.stock < quantity) {
    throw new BadRequestError(`Only ${product.stock} left in stock`);
  }

  const item = await upsertCartItem(userId, productId, quantity);
  res.status(201).json({ status: "ok", data: item });
}

export async function patchCartItem(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const { productId } = req.params;
  const { quantity } = req.body as { quantity: number };

  const product = await findProductById(productId);
  if (!product) {
    throw new NotFoundError("Product not found");
  }
  if (product.stock < quantity) {
    throw new BadRequestError(`Only ${product.stock} left in stock`);
  }

  const item = await setCartItemQuantity(userId, productId, quantity);
  if (!item) {
    throw new NotFoundError("Item not in cart");
  }
  res.status(200).json({ status: "ok", data: item });
}

export async function deleteCartItem(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const removed = await removeCartItem(userId, req.params.productId);
  if (!removed) {
    throw new NotFoundError("Item not in cart");
  }
  res.status(204).send();
}
