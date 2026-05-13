import { Navigate, Route, Routes } from 'react-router-dom'
import AuthLoginPage from '../pages/authservice/login-page/AuthLoginPage'
import AuthRegisterPage from '../pages/authservice/register-page/AuthRegisterPage'
import AuthForgotPasswordOtpPage from '../pages/authservice/forgot-password-otp-page/AuthForgotPasswordOtpPage'
import AuthForgotPasswordPage from '../pages/authservice/forgot-password-page/AuthForgotPasswordPage'
import SessionRedirect from '../components/auth/SessionRedirect'
import PublicOnlyRoute from '../components/auth/PublicOnlyRoute'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import RoleLayout from '../layouts/RoleLayout'
import { AppRole } from '../constants/roles'
import { roleRouteConfig } from '../config/routeConfig'
import { getAllowedRolesForRouteOwner } from '../config/roleConfig'
import ForbiddenPage from '../pages/commonservice/forbidden-page/ForbiddenPage'
import NotFoundPage from '../pages/commonservice/not-found-page/NotFoundPage'
import { isAuthenticated } from '../config/apis'
import UserOrdersPage from '../pages/userservice/user-orders-page/UserOrdersPage'

function AppRoutes() {
  const userRoutes = roleRouteConfig.filter((route) => route.role === AppRole.USER)
  const adminRoutes = roleRouteConfig.filter((route) => route.role === AppRole.ADMIN)
  const partnerRoutes = roleRouteConfig.filter(
    (route) => route.role === AppRole.SHOPEE_PARTNER,
  )

  return (
    <Routes>
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
          <Route path="/payment-return" element={<UserOrdersPage />} />
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
          <Route
            path="/admin/users"
            element={<Navigate to="/admin/administration" replace />}
          />
          <Route
            path="/admin/partners"
            element={<Navigate to="/admin/administration" replace />}
          />
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
  )
}

export default AppRoutes
