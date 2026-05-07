import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Loading from '../loading/Loading'
import { hydrateAuthSession } from '../../auth/authSession'
import type { AppRole } from '../../constants/roles'

type ProtectedRouteProps = {
  allowedRoles?: AppRole[]
}

type GuardState = {
  loading: boolean
  isAuthenticated: boolean
  role: AppRole | null
}

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const [guardState, setGuardState] = useState<GuardState>({
    loading: true,
    isAuthenticated: false,
    role: null,
  })

  useEffect(() => {
    let active = true

    async function runGuard() {
      const snapshot = await hydrateAuthSession()
      if (!active) {
        return
      }

      setGuardState({
        loading: false,
        isAuthenticated: snapshot.isAuthenticated,
        role: snapshot.role,
      })
    }

    void runGuard()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (guardState.loading) {
    return <Loading fullScreen text="Đang kiểm tra phiên đăng nhập..." />
  }

  if (!guardState.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (
    allowedRoles?.length &&
    (!guardState.role || !allowedRoles.includes(guardState.role))
  ) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
