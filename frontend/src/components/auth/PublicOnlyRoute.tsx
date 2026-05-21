import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Loading from '../loading/Loading'
import { hydrateAuthSession } from '../../auth/authSession'
import { AppRole } from '../../constants/roles'
import { getDefaultPathByRole } from '../../config/roleConfig'

type GuardState = {
  loading: boolean
  isAuthenticated: boolean
  role: AppRole | null
}

function PublicOnlyRoute() {
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
  }, [])

  if (guardState.loading) {
    return <Loading fullScreen text="Checking authentication session..." />
  }

  if (guardState.isAuthenticated) {
    const fallbackPath = guardState.role
      ? getDefaultPathByRole(guardState.role)
      : getDefaultPathByRole(AppRole.USER)

    return <Navigate to={fallbackPath} replace />
  }

  return <Outlet />
}

export default PublicOnlyRoute

