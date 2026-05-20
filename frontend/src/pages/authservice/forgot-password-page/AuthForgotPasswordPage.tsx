import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apis, endpoints, extractApiData } from '../../../config/apis'
import realtimeLogo from '../../../assets/logo/RealtimeLogo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import Loading from '../../../components/loading/Loading'
import PageTransition from '../../../components/transition/PageTransition'
import './AuthForgotPasswordPage.css'

type AuthForgotPasswordOtpInfo = {
  userId?: string
  message?: string
  email?: string
  expiresAt?: string
}

function parseExpiresAtToMillis(expiresAt?: string): number | null {
  if (!expiresAt) {
    return null
  }

  const normalized = expiresAt
    .trim()
    .replace(/\.(\d{3})\d+/, '.$1')

  const parsed = new Date(normalized).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function AuthForgotPasswordPage() {
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtpPopup, setShowOtpPopup] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [popupError, setPopupError] = useState('')
  const [popupSuccess, setPopupSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpInfo, setOtpInfo] = useState<AuthForgotPasswordOtpInfo | null>(null)
  const [countdownText, setCountdownText] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('forgotPasswordOtpInfo')
    if (!raw) {
      setOtpInfo(null)
      return
    }

    try {
      setOtpInfo(JSON.parse(raw) as AuthForgotPasswordOtpInfo)
    } catch {
      setOtpInfo(null)
    }
  }, [])

  const forgotPasswordUsername = useMemo(() => {
    return localStorage.getItem('forgotPasswordUsername') || ''
  }, [])

  const maskedEmail = useMemo(() => {
    const email = otpInfo?.email?.trim()
    if (!email) return ''

    const [, domain] = email.split('@')
    if (!domain) return email

    return `${email.charAt(0)}***@${domain}`
  }, [otpInfo?.email])

  useEffect(() => {
    const expiresAtMillis = parseExpiresAtToMillis(otpInfo?.expiresAt)

    if (!showOtpPopup || expiresAtMillis === null) {
      setCountdownText('')
      return
    }

    const updateCountdown = () => {
      const now = Date.now()
      const diff = expiresAtMillis - now

      if (diff <= 0) {
        setCountdownText('00:00')
        return
      }

      const totalSeconds = Math.floor(diff / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60

      setCountdownText(
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      )
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [showOtpPopup, otpInfo?.expiresAt])

  const isOtpExpired = useMemo(() => {
    const expiresAtMillis = parseExpiresAtToMillis(otpInfo?.expiresAt)
    if (expiresAtMillis === null) {
      return true
    }

    return expiresAtMillis <= Date.now()
  }, [otpInfo?.expiresAt, countdownText])

  const validatePasswordForm = () => {
    if (!newPassword.trim()) {
      setError('Please enter your new password.')
      return false
    }

    if (!confirmPassword.trim()) {
      setError('Please confirm your new password.')
      return false
    }

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.')
      return false
    }

    return true
  }

  const handleContinue: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPopupError('')
    setPopupSuccess('')

    if (!validatePasswordForm()) return
    setShowOtpPopup(true)
  }

  const handleSubmitForgotPassword = async () => {
    if (!forgotPasswordUsername.trim()) {
      setPopupError(
        'Account information is missing. Please go back and request OTP again.',
      )
      return
    }

    if (!otp.trim()) {
      setPopupError('Please enter the OTP code.')
      return
    }

    await apis().post(endpoints.auth.forgotPassword, {
      usernameOrEmail: forgotPasswordUsername.trim(),
      otp: otp.trim(),
      newPassword: newPassword.trim(),
    })

    localStorage.removeItem('forgotPasswordOtpInfo')
    localStorage.removeItem('forgotPasswordUsername')
    setShowOtpPopup(false)

    navigate('/login', {
      replace: true,
      state: {
        toastMessage: 'Password changed successfully. Please sign in again.',
      },
    })
  }

  const handleRenewOtp = async () => {
    if (!forgotPasswordUsername.trim()) {
      setPopupError(
        'Username/email is missing. Please return to the previous step.',
      )
      return
    }

    const response = await apis().post(endpoints.auth.otpForgotPassword, {
      usernameOrEmail: forgotPasswordUsername.trim(),
    })

    const data = extractApiData<AuthForgotPasswordOtpInfo>(response)

    setOtpInfo(data)
    setOtp('')
    setPopupSuccess(data?.message || 'OTP has been reissued successfully.')

    localStorage.setItem('forgotPasswordUsername', forgotPasswordUsername.trim())
    localStorage.setItem('forgotPasswordOtpInfo', JSON.stringify(data))
  }

  const handleOtpAction = async () => {
    setPopupError('')
    setPopupSuccess('')
    setError('')
    setSuccess('')

    try {
      setLoading(true)

      if (isOtpExpired) {
        await handleRenewOtp()
      } else {
        await handleSubmitForgotPassword()
      }
    } catch (err: any) {
      setPopupError(
        err?.response?.data?.message ||
          (isOtpExpired
            ? 'Unable to reissue OTP. Please try again.'
            : 'Password reset failed. Please verify your OTP.'),
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClosePopup = () => {
    if (loading) return
    setShowOtpPopup(false)
    setOtp('')
    setPopupError('')
    setPopupSuccess('')
  }

  const otpButtonText = useMemo(() => {
    if (loading) {
      return isOtpExpired ? 'Reissuing OTP...' : 'Verifying OTP...'
    }

    if (isOtpExpired) {
      return 'OTP expired - Reissue OTP'
    }

    return `Confirm OTP (${countdownText || '00:00'})`
  }, [loading, isOtpExpired, countdownText])

  return (
    <PageTransition>
      {loading && (
        <Loading
          fullScreen
          text={isOtpExpired ? 'Reissuing OTP...' : 'Updating password...'}
        />
      )}

      <section
        className="auth-forgot-password-page forgot-password-page-bg forgot-password-page-shell"
        style={{ backgroundImage: `url(${vnptBackground})` }}
      >
        <div className="forgot-password-bg-overlay">
          <div className="forgot-password-container-fluid forgot-password-h-custom">
            <div className="forgot-password-row forgot-password-d-flex forgot-password-justify-content-center forgot-password-align-items-center forgot-password-h-100">
              <div className="forgot-password-col-md-8 forgot-password-col-lg-6 forgot-password-col-xl-4">
                <form
                  onSubmit={handleContinue}
                  className="forgot-password-form-card"
                >
                  <div className="forgot-password-logo-wrap">
                    <img
                      src={realtimeLogo}
                      className="forgot-password-brand-image"
                      alt="Realtime Logo"
                    />
                  </div>

                  <div className="forgot-password-divider forgot-password-d-flex forgot-password-align-items-center forgot-password-my-4">
                    <p className="forgot-password-text-center forgot-password-fw-bold forgot-password-mx-3 forgot-password-mb-0">
                      Reset password
                    </p>
                  </div>

                  <p className="forgot-password-text-center forgot-password-mb-4 forgot-password-helper-text">
                    Enter a new password, then confirm using the OTP sent to your email.
                  </p>

                  {error && (
                    <div className="forgot-password-alert-danger">{error}</div>
                  )}

                  {success && (
                    <div className="forgot-password-alert-success">{success}</div>
                  )}

                  <div className="forgot-password-form-outline forgot-password-mb-3">
                    <label
                      className="forgot-password-form-label"
                      htmlFor="forgotPasswordNew"
                    >
                      New password
                    </label>
                    <input
                      type="password"
                      id="forgotPasswordNew"
                      className="forgot-password-form-control forgot-password-form-control-lg"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (error) setError('')
                        if (success) setSuccess('')
                      }}
                    />
                  </div>

                  <div className="forgot-password-form-outline forgot-password-mb-3">
                    <label
                      className="forgot-password-form-label"
                      htmlFor="forgotPasswordConfirm"
                    >
                      Confirm password
                    </label>
                    <input
                      type="password"
                      id="forgotPasswordConfirm"
                      className="forgot-password-form-control forgot-password-form-control-lg"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (error) setError('')
                        if (success) setSuccess('')
                      }}
                    />
                  </div>

                  <div className="forgot-password-form-options forgot-password-mb-3">
                    <button
                      type="button"
                      className="forgot-password-link-action"
                      onClick={() => navigate('/forgot-password-otp')}
                    >
                      Back to OTP request
                    </button>
                  </div>

                  <div className="forgot-password-text-center forgot-password-mt-4 forgot-password-pt-2">
                    <button
                      type="submit"
                      className="forgot-password-btn forgot-password-btn-primary forgot-password-btn-lg"
                      disabled={loading}
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {showOtpPopup && (
          <div
            className="forgot-password-modal-backdrop"
            onClick={handleClosePopup}
          >
            <div
              className="forgot-password-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="forgot-password-modal-header">
                <h3 className="forgot-password-modal-title">Confirm OTP</h3>
              </div>

              <div className="forgot-password-modal-body">
                {otpInfo?.email && (
                  <p className="forgot-password-modal-subtext forgot-password-modal-email">
                    OTP destination: <strong>{maskedEmail}</strong>
                  </p>
                )}

                {!forgotPasswordUsername && (
                  <div className="forgot-password-alert-danger">
                    Account information is missing. Please return to OTP request step.
                  </div>
                )}

                {popupError && (
                  <div className="forgot-password-alert-danger">{popupError}</div>
                )}

                {popupSuccess && (
                  <div className="forgot-password-alert-success">
                    {popupSuccess}
                  </div>
                )}

                <div className="forgot-password-form-outline forgot-password-mb-3">
                  <label
                    className="forgot-password-form-label"
                    htmlFor="forgotPasswordOtp"
                  >
                    OTP Code
                  </label>
                  <input
                    type="text"
                    id="forgotPasswordOtp"
                    className="forgot-password-form-control forgot-password-form-control-lg"
                    placeholder="Enter OTP code"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value)
                      if (popupError) setPopupError('')
                    }}
                    disabled={loading || !forgotPasswordUsername}
                  />
                </div>

                <button
                  type="button"
                  className="forgot-password-btn forgot-password-btn-primary forgot-password-btn-lg"
                  onClick={handleOtpAction}
                  disabled={loading || !forgotPasswordUsername}
                >
                  {otpButtonText}
                </button>
              </div>

              <div className="forgot-password-modal-footer">
                <button
                  type="button"
                  className="forgot-password-btn forgot-password-btn-secondary forgot-password-btn-lg"
                  onClick={handleClosePopup}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageTransition>
  )
}

export default AuthForgotPasswordPage
