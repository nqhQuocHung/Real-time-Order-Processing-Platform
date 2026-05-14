import { AppRole } from '../constants/roles'
import type { BackendMenuItem } from './apis'

export const roleDefaultPath: Record<AppRole, string> = {
  [AppRole.USER]: '/user/products',
  [AppRole.ADMIN]: '/admin/dashboard',
  [AppRole.SHOPEE_PARTNER]: '/user/products',
}

export function getDefaultPathByRole(role: AppRole): string {
  return roleDefaultPath[role]
}

function normalizePath(path?: string): string {
  if (!path) {
    return ''
  }

  const trimmed = path.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1)
  }

  return trimmed
}

function rolePrefix(role: AppRole): string {
  if (role === AppRole.ADMIN) {
    return '/admin/'
  }

  if (role === AppRole.SHOPEE_PARTNER) {
    return '/partner/'
  }

  return '/user/'
}

export function resolveDefaultPathByRole(
  role: AppRole,
  backendMenus: BackendMenuItem[] = [],
): string {
  if (!backendMenus.length) {
    return getDefaultPathByRole(role)
  }

  const normalizedMenus = backendMenus
    .map((menu) => ({
      path: normalizePath(menu.path),
      displayOrder: typeof menu.displayOrder === 'number' ? menu.displayOrder : 100,
      showOnMenu: menu.showOnMenu !== false,
      isContainer: Boolean(menu.isContainer),
    }))
    .filter((menu) => menu.path && !menu.isContainer && menu.showOnMenu)
    .sort((first, second) => {
      if (first.displayOrder !== second.displayOrder) {
        return first.displayOrder - second.displayOrder
      }
      return first.path.localeCompare(second.path)
    })

  const preferredPrefix = rolePrefix(role)
  const preferredPath = normalizedMenus.find((menu) => menu.path.startsWith(preferredPrefix))
  if (preferredPath) {
    return preferredPath.path
  }

  if (normalizedMenus[0]) {
    return normalizedMenus[0].path
  }

  return getDefaultPathByRole(role)
}

export function getAllowedRolesForRouteOwner(roleOwner: AppRole): AppRole[] {
  if (roleOwner === AppRole.ADMIN) {
    return [AppRole.ADMIN]
  }

  if (roleOwner === AppRole.SHOPEE_PARTNER) {
    return [AppRole.SHOPEE_PARTNER, AppRole.ADMIN]
  }

  return [AppRole.USER, AppRole.SHOPEE_PARTNER, AppRole.ADMIN]
}
