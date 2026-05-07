import type { AppRole } from '../constants/roles'
import { AppRole as Role } from '../constants/roles'
import { getAuthSession } from './apis'

export const PermissionKey = {
  VIEW_USER_DASHBOARD: 'VIEW_USER_DASHBOARD',
  MANAGE_SELF_ORDERS: 'MANAGE_SELF_ORDERS',
  VIEW_PRODUCT_CATALOG: 'VIEW_PRODUCT_CATALOG',
  VIEW_SELF_PROFILE: 'VIEW_SELF_PROFILE',
  VIEW_SUPPORT: 'VIEW_SUPPORT',

  VIEW_ADMIN_DASHBOARD: 'VIEW_ADMIN_DASHBOARD',
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_PARTNERS: 'MANAGE_PARTNERS',
  MANAGE_PRODUCTS: 'MANAGE_PRODUCTS',
  MANAGE_ALL_ORDERS: 'MANAGE_ALL_ORDERS',
  VIEW_REPORTS: 'VIEW_REPORTS',
  MANAGE_SYSTEM_SETTINGS: 'MANAGE_SYSTEM_SETTINGS',

  VIEW_PARTNER_DASHBOARD: 'VIEW_PARTNER_DASHBOARD',
  MANAGE_PARTNER_PRODUCTS: 'MANAGE_PARTNER_PRODUCTS',
  MANAGE_PARTNER_ORDERS: 'MANAGE_PARTNER_ORDERS',
  MANAGE_PARTNER_INVENTORY: 'MANAGE_PARTNER_INVENTORY',
  VIEW_PARTNER_REVENUE: 'VIEW_PARTNER_REVENUE',
  VIEW_PARTNER_PROFILE: 'VIEW_PARTNER_PROFILE',
} as const

export type PermissionKey = (typeof PermissionKey)[keyof typeof PermissionKey]

export const permissionConfig: Record<AppRole, PermissionKey[]> = {
  [Role.USER]: [
    PermissionKey.VIEW_USER_DASHBOARD,
    PermissionKey.MANAGE_SELF_ORDERS,
    PermissionKey.VIEW_PRODUCT_CATALOG,
    PermissionKey.VIEW_SELF_PROFILE,
    PermissionKey.VIEW_SUPPORT,
  ],
  [Role.ADMIN]: [
    PermissionKey.VIEW_ADMIN_DASHBOARD,
    PermissionKey.MANAGE_USERS,
    PermissionKey.MANAGE_PARTNERS,
    PermissionKey.MANAGE_PRODUCTS,
    PermissionKey.MANAGE_ALL_ORDERS,
    PermissionKey.VIEW_REPORTS,
    PermissionKey.MANAGE_SYSTEM_SETTINGS,
    PermissionKey.VIEW_USER_DASHBOARD,
    PermissionKey.VIEW_PARTNER_DASHBOARD,
  ],
  [Role.SHOPEE_PARTNER]: [
    PermissionKey.VIEW_PARTNER_DASHBOARD,
    PermissionKey.MANAGE_PARTNER_PRODUCTS,
    PermissionKey.MANAGE_PARTNER_ORDERS,
    PermissionKey.MANAGE_PARTNER_INVENTORY,
    PermissionKey.VIEW_PARTNER_REVENUE,
    PermissionKey.VIEW_PARTNER_PROFILE,
  ],
}

export function hasPermission(role: AppRole, permission: PermissionKey): boolean {
  const backendPermissions = getAuthSession()?.backendPermissions || []
  if (backendPermissions.length > 0) {
    return backendPermissions.includes(permission)
  }
  return permissionConfig[role]?.includes(permission) || false
}
