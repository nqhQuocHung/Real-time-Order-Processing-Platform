import { AppRole, resolvePrimaryRole } from '../constants/roles'
import {
  apis,
  type BackendMenuItem,
  clearAuthSession,
  endpoints,
  extractApiData,
  getAuthSession,
  setAuthSession,
} from '../config/apis'

export type UserProfileResponse = {
  userId: string
  username: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  avatar?: string
  status?: string
  isActive?: boolean
  roles?: string[]
  permissions?: string[]
  menus?: BackendMenuItem[]
  createdAt?: string
  updatedAt?: string
}

export type LoginResponseData = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userId: string
  username: string
  email: string
}

export type AuthSnapshot = {
  isAuthenticated: boolean
  role: AppRole | null
  profile: UserProfileResponse | null
}

export async function fetchMyProfile(): Promise<UserProfileResponse> {
  const response = await apis().get(endpoints.auth.me)
  return extractApiData<UserProfileResponse>(response)
}

export async function completeLoginSession(loginData: LoginResponseData) {
  setAuthSession({
    accessToken: loginData.accessToken,
    refreshToken: loginData.refreshToken,
    tokenType: loginData.tokenType,
    userId: loginData.userId,
    username: loginData.username,
    email: loginData.email,
  })

  const profile = await fetchMyProfile()
  const backendRoles = profile.roles || []
  const role = resolvePrimaryRole(backendRoles)

  setAuthSession({
    userId: profile.userId || loginData.userId,
    username: profile.username || loginData.username,
    email: profile.email || loginData.email,
    role,
    backendRoles,
    backendPermissions: profile.permissions || [],
    backendMenus: profile.menus || [],
  })

  return { role, profile }
}

export async function hydrateAuthSession(): Promise<AuthSnapshot> {
  const session = getAuthSession()
  if (!session?.accessToken) {
    return {
      isAuthenticated: false,
      role: null,
      profile: null,
    }
  }

  try {
    const profile = await fetchMyProfile()
    const backendRoles = profile.roles || []
    const role = resolvePrimaryRole(backendRoles)

    setAuthSession({
      userId: profile.userId || session.userId,
      username: profile.username || session.username,
      email: profile.email || session.email,
      role,
      backendRoles,
      backendPermissions: profile.permissions || [],
      backendMenus: profile.menus || [],
    })

    return {
      isAuthenticated: true,
      role,
      profile,
    }
  } catch {
    clearAuthSession()
    return {
      isAuthenticated: false,
      role: null,
      profile: null,
    }
  }
}
