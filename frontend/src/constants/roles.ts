export const AppRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SHOPEE_PARTNER: 'SHOPEE_PARTNER',
} as const

export type AppRole = (typeof AppRole)[keyof typeof AppRole]

export const ALL_ROLES: AppRole[] = [
  AppRole.USER,
  AppRole.ADMIN,
  AppRole.SHOPEE_PARTNER,
]

export function getRoleLabel(role: AppRole): string {
  switch (role) {
    case AppRole.ADMIN:
      return 'Admin'
    case AppRole.SHOPEE_PARTNER:
      return 'Shopee Partner'
    case AppRole.USER:
    default:
      return 'User'
  }
}

function normalizeRoleValue(value: string): string {
  return value.trim().toUpperCase()
}

export function mapBackendRoleToAppRole(
  backendRole: string,
): AppRole | undefined {
  const normalized = normalizeRoleValue(backendRole)

  if (normalized === AppRole.ADMIN) {
    return AppRole.ADMIN
  }

  if (
    normalized === AppRole.SHOPEE_PARTNER ||
    normalized === 'PARTNER' ||
    normalized === 'SHOPEE_PARTNER_MANAGER'
  ) {
    return AppRole.SHOPEE_PARTNER
  }

  if (normalized === AppRole.USER || normalized === 'CUSTOMER') {
    return AppRole.USER
  }

  return undefined
}

export function resolvePrimaryRole(rawRoles: string[] = []): AppRole {
  const roles = rawRoles.map(mapBackendRoleToAppRole).filter(Boolean) as AppRole[]

  if (roles.includes(AppRole.ADMIN)) {
    return AppRole.ADMIN
  }

  if (roles.includes(AppRole.SHOPEE_PARTNER)) {
    return AppRole.SHOPEE_PARTNER
  }

  return AppRole.USER
}
