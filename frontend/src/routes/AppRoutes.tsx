import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AuthLoginPage from '../pages/login/AuthLoginPage'
import AuthRegisterPage from '../pages/register/AuthRegisterPage'
import AuthForgotPasswordOtpPage from '../pages/forgot-password-Otp/AuthForgotPasswordOtpPage'
import AuthForgotPasswordPage from '../pages/forgot-password/AuthForgotPasswordPage'
import SessionRedirect from '../components/auth/SessionRedirect'
import PublicOnlyRoute from '../components/auth/PublicOnlyRoute'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import RoleLayout from '../layouts/RoleLayout'
import { AppRole } from '../constants/roles'
import { roleRouteConfig } from '../config/routeConfig'
import { getAllowedRolesForRouteOwner } from '../config/roleConfig'
import ForbiddenPage from '../pages/common/ForbiddenPage'
import NotFoundPage from '../pages/common/NotFoundPage'
import { isAuthenticated } from '../config/apis'

function AppRoutes() {
  const location = useLocation()

  const userRoutes = roleRouteConfig.filter((route) => route.role === AppRole.USER)
  const adminRoutes = roleRouteConfig.filter((route) => route.role === AppRole.ADMIN)
  const partnerRoutes = roleRouteConfig.filter(
    (route) => route.role === AppRole.SHOPEE_PARTNER,
  )

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<SessionRedirect />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<AuthLoginPage />} />
          <Route path="/register" element={<AuthRegisterPage />} />
          <Route path="/forgot-password-otp" element={<AuthForgotPasswordOtpPage />} />
          <Route path="/forgot-password" element={<AuthForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleLayout />}>
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute
              allowedRoles={getAllowedRolesForRouteOwner(AppRole.USER)}
            />
          }
        >
          <Route element={<RoleLayout />}>
            {userRoutes.map((route) => {
              const Component = route.component
              return <Route key={route.path} path={route.path} element={<Component />} />
            })}
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute
              allowedRoles={getAllowedRolesForRouteOwner(AppRole.ADMIN)}
            />
          }
        >
          <Route element={<RoleLayout />}>
            {adminRoutes.map((route) => {
              const Component = route.component
              return <Route key={route.path} path={route.path} element={<Component />} />
            })}
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute
              allowedRoles={getAllowedRolesForRouteOwner(AppRole.SHOPEE_PARTNER)}
            />
          }
        >
          <Route element={<RoleLayout />}>
            {partnerRoutes.map((route) => {
              const Component = route.component
              return <Route key={route.path} path={route.path} element={<Component />} />
            })}
          </Route>
        </Route>

        <Route
          path="*"
          element={
            isAuthenticated() ? <Navigate to="/404" replace /> : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

export default AppRoutes
