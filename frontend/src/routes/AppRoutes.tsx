import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import AuthLoginPage from '../pages/login/AuthLoginPage'
import AuthRegisterPage from '../pages/register/AuthRegisterPage'
import AuthForgotPasswordOtpPage from '../pages/forgot-password-Otp/AuthForgotPasswordOtpPage'
import AuthForgotPasswordPage from '../pages/forgot-password/AuthForgotPasswordPage'
import HomePage from '../pages/HomePage'

function PrivateRoute({ children }: { children: ReactNode }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthLoginPage />} />
        <Route path="/register" element={<AuthRegisterPage />} />
        <Route path="/forgot-password-otp" element={<AuthForgotPasswordOtpPage />} />
        <Route path="/forgot-password" element={<AuthForgotPasswordPage />} />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

export default AppRoutes
