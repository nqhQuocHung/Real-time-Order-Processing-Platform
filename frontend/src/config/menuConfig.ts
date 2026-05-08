import { AppRole } from '../constants/roles'
import { PermissionKey } from './permissionConfig'

export type MenuItem = {
  key: string
  label: string
  path: string
  permission: PermissionKey
}

export const menuConfig: Record<AppRole, MenuItem[]> = {
  [AppRole.USER]: [
    {
      key: 'user-dashboard',
      label: 'Dashboard',
      path: '/user/dashboard',
      permission: PermissionKey.VIEW_USER_DASHBOARD,
    },
    {
      key: 'user-orders',
      label: 'Orders',
      path: '/user/orders',
      permission: PermissionKey.MANAGE_SELF_ORDERS,
    },
    {
      key: 'user-products',
      label: 'Products',
      path: '/user/products',
      permission: PermissionKey.VIEW_PRODUCT_CATALOG,
    },
    {
      key: 'user-profile',
      label: 'Profile',
      path: '/user/profile',
      permission: PermissionKey.VIEW_SELF_PROFILE,
    },
    {
      key: 'user-support',
      label: 'Support',
      path: '/user/support',
      permission: PermissionKey.VIEW_SUPPORT,
    },
  ],
  [AppRole.ADMIN]: [
    {
      key: 'admin-dashboard',
      label: 'Admin Dashboard',
      path: '/admin/dashboard',
      permission: PermissionKey.VIEW_ADMIN_DASHBOARD,
    },
    {
      key: 'admin-administration',
      label: 'Administration',
      path: '/admin/administration',
      permission: PermissionKey.MANAGE_USERS,
    },
    {
      key: 'admin-access-management',
      label: 'Access Management',
      path: '/admin/access-management',
      permission: PermissionKey.MANAGE_USERS,
    },
    {
      key: 'admin-users',
      label: 'User Management',
      path: '/admin/users',
      permission: PermissionKey.MANAGE_USERS,
    },
    {
      key: 'admin-partners',
      label: 'Partner Management',
      path: '/admin/partners',
      permission: PermissionKey.MANAGE_PARTNERS,
    },
    {
      key: 'admin-products',
      label: 'Product Management',
      path: '/admin/products',
      permission: PermissionKey.MANAGE_PRODUCTS,
    },
    {
      key: 'admin-orders',
      label: 'Order Management',
      path: '/admin/orders',
      permission: PermissionKey.MANAGE_ALL_ORDERS,
    },
    {
      key: 'admin-reports',
      label: 'Reports',
      path: '/admin/reports',
      permission: PermissionKey.VIEW_REPORTS,
    },
    {
      key: 'admin-settings',
      label: 'System Settings',
      path: '/admin/settings',
      permission: PermissionKey.MANAGE_SYSTEM_SETTINGS,
    },
  ],
  [AppRole.SHOPEE_PARTNER]: [
    {
      key: 'partner-dashboard',
      label: 'Partner Dashboard',
      path: '/partner/dashboard',
      permission: PermissionKey.VIEW_PARTNER_DASHBOARD,
    },
    {
      key: 'partner-products',
      label: 'My Products',
      path: '/partner/products',
      permission: PermissionKey.MANAGE_PARTNER_PRODUCTS,
    },
    {
      key: 'partner-orders',
      label: 'Shopee Orders',
      path: '/partner/orders',
      permission: PermissionKey.MANAGE_PARTNER_ORDERS,
    },
    {
      key: 'partner-inventory',
      label: 'Inventory',
      path: '/partner/inventory',
      permission: PermissionKey.MANAGE_PARTNER_INVENTORY,
    },
    {
      key: 'partner-revenue',
      label: 'Revenue Report',
      path: '/partner/revenue',
      permission: PermissionKey.VIEW_PARTNER_REVENUE,
    },
    {
      key: 'partner-profile',
      label: 'Partner Profile',
      path: '/partner/profile',
      permission: PermissionKey.VIEW_PARTNER_PROFILE,
    },
  ],
}
