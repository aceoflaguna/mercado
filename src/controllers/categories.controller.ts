import { Request, Response } from "express";
import { listCategories, createCategory } from "../repositories/categories.repository";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const categories = await listCategories();
  res.status(200).json({ status: "ok", data: categories });
}

export async function postCategory(req: Request, res: Response): Promise<void> {
  const { name } = req.body as { name: string };
  const category = await createCategory(name, slugify(name));
  res.status(201).json({ status: "ok", data: category });
}
