import { Request, Response } from "express";
import {
  listAddressesForUser,
  findAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../repositories/addresses.repository";
import { NotFoundError } from "../types/errors";

export async function getAddresses(req: Request, res: Response): Promise<void> {
  const addresses = await listAddressesForUser(req.user!.sub);
  res.status(200).json({ status: "ok", data: addresses });
}

export async function postAddress(req: Request, res: Response): Promise<void> {
  const { label, fullAddress, isDefault } = req.body as {
    label: string;
    fullAddress: string;
    isDefault: boolean;
  };
  const address = await createAddress({ userId: req.user!.sub, label, fullAddress, isDefault });
  res.status(201).json({ status: "ok", data: address });
}

export async function patchAddress(req: Request, res: Response): Promise<void> {
  const existing = await findAddressById(req.params.id, req.user!.sub);
  if (!existing) throw new NotFoundError("Address not found");
  const updated = await updateAddress(req.params.id, req.user!.sub, req.body);
  res.status(200).json({ status: "ok", data: updated });
}

export async function removeAddress(req: Request, res: Response): Promise<void> {
  const removed = await deleteAddress(req.params.id, req.user!.sub);
  if (!removed) throw new NotFoundError("Address not found");
  res.status(204).send();
}