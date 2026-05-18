"use client";

import { useSearchParams } from "next/navigation";

export type Role = "handy" | "table" | "mobile";

const VALID_ROLES: Role[] = ["handy", "table", "mobile"];

/**
 * Reads the `?role=` URL search parameter and returns the active Role.
 * Defaults to "handy" when the parameter is absent or invalid.
 *
 * Must be called from a Client Component that is wrapped in a <Suspense>
 * boundary (required by Next.js App Router for static prerendering).
 */
export function useRoleLayout(): Role {
  const searchParams = useSearchParams();
  const raw = searchParams.get("role");
  if (raw && (VALID_ROLES as string[]).includes(raw)) {
    return raw as Role;
  }
  return "handy";
}
