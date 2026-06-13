import { db, pharmacyModulesTable, userPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const PHARMACY_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "checkout", label: "Checkout" },
  { key: "products", label: "Products" },
  { key: "inventory", label: "Inventory" },
  { key: "sales", label: "Sales" },
  { key: "staff", label: "Staff" },
  { key: "messages", label: "Messages" },
] as const;

export const DEFAULT_MODULE_KEYS = PHARMACY_MODULES.map(module => module.key);

export async function getEnabledModules(pharmacyId: number | null | undefined) {
  if (!pharmacyId) return [];
  const rows = await db.select().from(pharmacyModulesTable).where(eq(pharmacyModulesTable.pharmacyId, pharmacyId));
  if (rows.length === 0) return DEFAULT_MODULE_KEYS;
  const enabled = new Set(rows.filter(row => row.enabled).map(row => row.moduleKey));
  return DEFAULT_MODULE_KEYS.filter(key => enabled.has(key));
}

export async function setEnabledModules(pharmacyId: number, moduleKeys: string[]) {
  const enabled = new Set(moduleKeys.filter(key => DEFAULT_MODULE_KEYS.includes(key as any)));
  await Promise.all(DEFAULT_MODULE_KEYS.map(moduleKey => {
    const values = { pharmacyId, moduleKey, enabled: enabled.has(moduleKey) ? 1 : 0 };
    return db.insert(pharmacyModulesTable).values(values).onDuplicateKeyUpdate({ set: values });
  }));
  return getEnabledModules(pharmacyId);
}

export async function getUserEnabledModules(userId: number, pharmacyId: number | null | undefined) {
  const pharmacyModules = await getEnabledModules(pharmacyId);
  if (!pharmacyId) return [];
  const rows = await db.select().from(userPermissionsTable).where(eq(userPermissionsTable.userId, userId));
  if (rows.length === 0) return pharmacyModules;
  const enabled = new Set(rows.filter(row => row.enabled).map(row => row.moduleKey));
  return pharmacyModules.filter(key => enabled.has(key));
}

export async function setUserEnabledModules(userId: number, moduleKeys: string[]) {
  const enabled = new Set(moduleKeys.filter(key => DEFAULT_MODULE_KEYS.includes(key as any)));
  await Promise.all(DEFAULT_MODULE_KEYS.map(moduleKey => {
    const values = { userId, moduleKey, enabled: enabled.has(moduleKey) ? 1 : 0 };
    return db.insert(userPermissionsTable).values(values).onDuplicateKeyUpdate({ set: values });
  }));
}
