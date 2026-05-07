import type { ComponentType } from 'react'
import { AppRole } from '../constants/roles'
import { PermissionKey } from './permissionConfig'
import UserDashboardPage from '../pages/user/UserDashboardPage'
import UserOrdersPage from '../pages/user/UserOrdersPage'
import UserProductsPage from '../pages/user/UserProductsPage'
import UserProfilePage from '../pages/user/UserProfilePage'
import UserSupportPage from '../pages/user/UserSupportPage'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminUserManagementPage from '../pages/admin/AdminUserManagementPage'
import AdminPartnerManagementPage from '../pages/admin/AdminPartnerManagementPage'
import AdminProductManagementPage from '../pages/admin/AdminProductManagementPage'
import AdminOrderManagementPage from '../pages/admin/AdminOrderManagementPage'
import AdminReportsPage from '../pages/admin/AdminReportsPage'
import AdminSystemSettingsPage from '../pages/admin/AdminSystemSettingsPage'
import PartnerDashboardPage from '../pages/partner/PartnerDashboardPage'
import PartnerProductsPage from '../pages/partner/PartnerProductsPage'
import PartnerOrdersPage from '../pages/partner/PartnerOrdersPage'
import PartnerInventoryPage from '../pages/partner/PartnerInventoryPage'
import PartnerRevenueReportPage from '../pages/partner/PartnerRevenueReportPage'
import PartnerProfilePage from '../pages/partner/PartnerProfilePage'

export type AppRouteItem = {
  path: string
  role: AppRole
  title: string
  permission: PermissionKey
  component: ComponentType
}

export const roleRouteConfig: AppRouteItem[] = [
  {
    path: '/user/dashboard',
    role: AppRole.USER,
    title: 'User Dashboard',
    permission: PermissionKey.VIEW_USER_DASHBOARD,
    component: UserDashboardPage,
  },
  {
    path: '/user/orders',
    role: AppRole.USER,
    title: 'Orders',
    permission: PermissionKey.MANAGE_SELF_ORDERS,
    component: UserOrdersPage,
  },
  {
    path: '/user/products',
    role: AppRole.USER,
    title: 'Products',
    permission: PermissionKey.VIEW_PRODUCT_CATALOG,
    component: UserProductsPage,
  },
  {
    path: '/user/profile',
    role: AppRole.USER,
    title: 'Profile',
    permission: PermissionKey.VIEW_SELF_PROFILE,
    component: UserProfilePage,
  },
  {
    path: '/user/support',
    role: AppRole.USER,
    title: 'Support',
    permission: PermissionKey.VIEW_SUPPORT,
    component: UserSupportPage,
  },
  {
    path: '/admin/dashboard',
    role: AppRole.ADMIN,
    title: 'Admin Dashboard',
    permission: PermissionKey.VIEW_ADMIN_DASHBOARD,
    component: AdminDashboardPage,
  },
  {
    path: '/admin/users',
    role: AppRole.ADMIN,
    title: 'User Management',
    permission: PermissionKey.MANAGE_USERS,
    component: AdminUserManagementPage,
  },
  {
    path: '/admin/partners',
    role: AppRole.ADMIN,
    title: 'Partner Management',
    permission: PermissionKey.MANAGE_PARTNERS,
    component: AdminPartnerManagementPage,
  },
  {
    path: '/admin/products',
    role: AppRole.ADMIN,
    title: 'Product Management',
    permission: PermissionKey.MANAGE_PRODUCTS,
    component: AdminProductManagementPage,
  },
  {
    path: '/admin/orders',
    role: AppRole.ADMIN,
    title: 'Order Management',
    permission: PermissionKey.MANAGE_ALL_ORDERS,
    component: AdminOrderManagementPage,
  },
  {
    path: '/admin/reports',
    role: AppRole.ADMIN,
    title: 'Reports',
    permission: PermissionKey.VIEW_REPORTS,
    component: AdminReportsPage,
  },
  {
    path: '/admin/settings',
    role: AppRole.ADMIN,
    title: 'System Settings',
    permission: PermissionKey.MANAGE_SYSTEM_SETTINGS,
    component: AdminSystemSettingsPage,
  },
  {
    path: '/partner/dashboard',
    role: AppRole.SHOPEE_PARTNER,
    title: 'Partner Dashboard',
    permission: PermissionKey.VIEW_PARTNER_DASHBOARD,
    component: PartnerDashboardPage,
  },
  {
    path: '/partner/products',
    role: AppRole.SHOPEE_PARTNER,
    title: 'My Products',
    permission: PermissionKey.MANAGE_PARTNER_PRODUCTS,
    component: PartnerProductsPage,
  },
  {
    path: '/partner/orders',
    role: AppRole.SHOPEE_PARTNER,
    title: 'Shopee Orders',
    permission: PermissionKey.MANAGE_PARTNER_ORDERS,
    component: PartnerOrdersPage,
  },
  {
    path: '/partner/inventory',
    role: AppRole.SHOPEE_PARTNER,
    title: 'Inventory',
    permission: PermissionKey.MANAGE_PARTNER_INVENTORY,
    component: PartnerInventoryPage,
  },
  {
    path: '/partner/revenue',
    role: AppRole.SHOPEE_PARTNER,
    title: 'Revenue Report',
    permission: PermissionKey.VIEW_PARTNER_REVENUE,
    component: PartnerRevenueReportPage,
  },
  {
    path: '/partner/profile',
    role: AppRole.SHOPEE_PARTNER,
    title: 'Partner Profile',
    permission: PermissionKey.VIEW_PARTNER_PROFILE,
    component: PartnerProfilePage,
  },
]
