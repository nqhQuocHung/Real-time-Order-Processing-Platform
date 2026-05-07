import { AppRole } from '../constants/roles'

export const roleDefaultPath: Record<AppRole, string> = {
  [AppRole.USER]: '/user/dashboard',
  [AppRole.ADMIN]: '/admin/dashboard',
  [AppRole.SHOPEE_PARTNER]: '/partner/dashboard',
}

export function getDefaultPathByRole(role: AppRole): string {
  return roleDefaultPath[role]
}

export function getAllowedRolesForRouteOwner(roleOwner: AppRole): AppRole[] {
  if (roleOwner === AppRole.ADMIN) {
    return [AppRole.ADMIN]
  }

  if (roleOwner === AppRole.SHOPEE_PARTNER) {
    return [AppRole.SHOPEE_PARTNER, AppRole.ADMIN]
  }

  return [AppRole.USER, AppRole.ADMIN]
}
