import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { getAuthSession } from '../../config/apis'
import { hasPermission, type PermissionKey } from '../../config/permissionConfig'

type RoutePermissionGuardProps = {
  routePath: string
  permission?: PermissionKey
  allowPermissionFallback?: boolean
  children: ReactElement
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

function hasMenuPathAccess(routePath: string): boolean {
  const sessionMenus = getAuthSession()?.backendMenus || []
  if (!sessionMenus.length) {
    return false
  }

  const normalizedRoutePath = normalizePath(routePath)
  return sessionMenus.some((menu) => normalizePath(menu.path) === normalizedRoutePath)
}

function RoutePermissionGuard({
  routePath,
  permission,
  allowPermissionFallback = false,
  children,
}: RoutePermissionGuardProps) {
  const session = getAuthSession()
  const role = session?.role

  if (!session?.accessToken || !role) {
    return <Navigate to="/login" replace />
  }

  const hasDynamicMenu = (session.backendMenus || []).length > 0
  const permissionGranted = permission ? hasPermission(role, permission) : true

  if (hasDynamicMenu) {
    const menuGranted = hasMenuPathAccess(routePath)
    if (menuGranted) {
      return children
    }

    if (allowPermissionFallback && permissionGranted) {
      return children
    }

    return <Navigate to="/403" replace />
  }

  if (!permissionGranted) {
    return <Navigate to="/403" replace />
  }

  return children
}

export default RoutePermissionGuard
