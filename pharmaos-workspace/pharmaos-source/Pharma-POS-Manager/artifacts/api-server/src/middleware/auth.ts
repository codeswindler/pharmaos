import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "pharmaos-dev-secret-change-in-production";

export type UserRole = "super_admin" | "pharmacy_owner" | "manager" | "cashier";

export interface AuthPayload {
  userId: number;
  email: string;
  role: UserRole;
  pharmacyId: number | null;
}

export type AuthenticatedRequest = Request & { user: AuthPayload };

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    (req as AuthenticatedRequest).user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const requireRoles = (...roles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !roles.includes(user.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
};

export const requireSuperAdmin = requireRoles("super_admin");
export const requireManagement = requireRoles("pharmacy_owner", "manager");

export function getPharmacyId(req: Request): number {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.pharmacyId) throw new Error("A pharmacy account is required");
  return user.pharmacyId;
}
