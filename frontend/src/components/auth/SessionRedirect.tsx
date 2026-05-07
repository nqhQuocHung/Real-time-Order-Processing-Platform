import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Loading from '../loading/Loading'
import { hydrateAuthSession } from '../../auth/authSession'
import { AppRole } from '../../constants/roles'
import { getDefaultPathByRole } from '../../config/roleConfig'

type RedirectState = {
  loading: boolean
  isAuthenticated: boolean
  role: AppRole | null
}

function SessionRedirect() {
  const [state, setState] = useState<RedirectState>({
    loading: true,
    isAuthenticated: false,
    role: null,
  })

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const snapshot = await hydrateAuthSession()
      if (!active) {
        return
      }
      setState({
        loading: false,
        isAuthenticated: snapshot.isAuthenticated,
        role: snapshot.role,
      })
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [])

  if (state.loading) {
    return <Loading fullScreen text="Đang khởi tạo phiên làm việc..." />
  }

  if (!state.isAuthenticated || !state.role) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getDefaultPathByRole(state.role)} replace />
}

export default SessionRedirect
