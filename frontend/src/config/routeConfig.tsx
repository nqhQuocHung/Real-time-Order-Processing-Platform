import type { ComponentType } from 'react'
import { AppRole } from '../constants/roles'
import { PermissionKey } from './permissionConfig'
import UserDashboardPage from '../pages/userservice/user-dashboard-page/UserDashboardPage'
import UserOrdersPage from '../pages/userservice/user-orders-page/UserOrdersPage'
import UserProductsPage from '../pages/userservice/user-products-page/UserProductsPage'
import UserProfilePage from '../pages/userservice/user-profile-page/UserProfilePage'
import UserSupportPage from '../pages/userservice/user-support-page/UserSupportPage'
import AdminDashboardPage from '../pages/adminservice/admin-dashboard-page/AdminDashboardPage'
import AdminAdministrationPage from '../pages/adminservice/admin-administration-page/AdminAdministrationPage'
import AdminUserManagementPage from '../pages/adminservice/admin-user-management-page/AdminUserManagementPage'
import AdminPartnerManagementPage from '../pages/adminservice/admin-partner-management-page/AdminPartnerManagementPage'
import AdminProductManagementPage from '../pages/adminservice/admin-product-management-page/AdminProductManagementPage'
import AdminOrderManagementPage from '../pages/adminservice/admin-order-management-page/AdminOrderManagementPage'
import AdminReportsPage from '../pages/adminservice/admin-reports-page/AdminReportsPage'
import AdminSystemSettingsPage from '../pages/adminservice/admin-system-settings-page/AdminSystemSettingsPage'
import AdminAccessManagementPage from '../pages/adminservice/admin-access-management-page/AdminAccessManagementPage'
import PartnerDashboardPage from '../pages/partnerservice/partner-dashboard-page/PartnerDashboardPage'
import PartnerProductsPage from '../pages/partnerservice/partner-products-page/PartnerProductsPage'
import PartnerOrdersPage from '../pages/partnerservice/partner-orders-page/PartnerOrdersPage'
import PartnerInventoryPage from '../pages/partnerservice/partner-inventory-page/PartnerInventoryPage'
import PartnerRevenueReportPage from '../pages/partnerservice/partner-revenue-report-page/PartnerRevenueReportPage'
import PartnerProfilePage from '../pages/partnerservice/partner-profile-page/PartnerProfilePage'

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
    path: '/admin/administration',
    role: AppRole.ADMIN,
    title: 'Administration',
    permission: PermissionKey.MANAGE_USERS,
    component: AdminAdministrationPage,
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
    path: '/admin/access-management',
    role: AppRole.ADMIN,
    title: 'Access Management',
    permission: PermissionKey.MANAGE_USERS,
    component: AdminAccessManagementPage,
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
