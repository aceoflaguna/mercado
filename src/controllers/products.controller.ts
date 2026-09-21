import { Request, Response } from "express";
import {
  listProducts,
  findProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../repositories/products.repository";
import { NotFoundError, ForbiddenError } from "../types/errors";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  // Append a short random suffix so two sellers can both list "iPhone Case".
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const { search, categoryId, page, pageSize } = req.query as unknown as {
    search?: string;
    categoryId?: number;
    page: number;
    pageSize: number;
  };

  const { items, total } = await listProducts({ search, categoryId, page, pageSize });

  res.status(200).json({
    status: "ok",
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function getProductById(req: Request, res: Response): Promise<void> {
  const product = await findProductById(req.params.id);
  if (!product || !product.is_active) {
    throw new NotFoundError("Product not found");
  }
  res.status(200).json({ status: "ok", data: product });
}

export async function postProduct(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const { name, description, categoryId, priceCents, stock, imageUrl } = req.body as {
    name: string;
    description: string;
    categoryId?: number | null;
    priceCents: number;
    stock: number;
    imageUrl?: string | null;
  };

  const product = await createProduct({
    sellerId,
    categoryId: categoryId ?? null,
    name,
    slug: slugify(name),
    description,
    priceCents,
    stock,
    imageUrl: imageUrl ?? null,
  });

  res.status(201).json({ status: "ok", data: product });
}

export async function patchProduct(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const existing = await findProductById(req.params.id);
  if (!existing) {
    throw new NotFoundError("Product not found");
  }
  if (existing.seller_id !== sellerId && req.user!.role !== "admin") {
    throw new ForbiddenError("You do not own this product");
  }

  const updated = await updateProduct(req.params.id, existing.seller_id, req.body);
  res.status(200).json({ status: "ok", data: updated });
}

export async function removeProduct(req: Request, res: Response): Promise<void> {
  const sellerId = req.user!.sub;
  const existing = await findProductById(req.params.id);
  if (!existing) {
    throw new NotFoundError("Product not found");
  }
  if (existing.seller_id !== sellerId && req.user!.role !== "admin") {
    throw new ForbiddenError("You do not own this product");
  }

  await deleteProduct(req.params.id, existing.seller_id);
  res.status(204).send();
}
