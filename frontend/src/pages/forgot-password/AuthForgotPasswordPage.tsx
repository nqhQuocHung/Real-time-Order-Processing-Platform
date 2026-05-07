import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apis, endpoints, extractApiData } from '../../config/apis'
import vnptLogo from '../../assets/logo/vnpt_logo.png'
import vnptBackground from '../../assets/logo/vnpt_bg.png'
import Loading from '../../components/loading/Loading'
import PageTransition from '../../components/transition/PageTransition'
import './AuthForgotPasswordPage.css'

type AuthForgotPasswordOtpInfo = {
  userId?: string
  message?: string
  email?: string
  expiresAt?: string
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
    if (!showOtpPopup || !otpInfo?.expiresAt) {
      setCountdownText('')
      return
    }

    const updateCountdown = () => {
      const expireTime = new Date(otpInfo.expiresAt as string).getTime()
      const now = Date.now()
      const diff = expireTime - now

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
    if (!otpInfo?.expiresAt) return true
    return new Date(otpInfo.expiresAt).getTime() <= Date.now()
  }, [otpInfo?.expiresAt, countdownText])

  const validatePasswordForm = () => {
    if (!newPassword.trim()) {
      setError('Vui lòng nhập mật khẩu mới')
      return false
    }

    if (!confirmPassword.trim()) {
      setError('Vui lòng nhập xác nhận mật khẩu')
      return false
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
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
        'Không tìm thấy tài khoản để xác thực. Vui lòng quay lại bước gửi OTP.',
      )
      return
    }

    if (!otp.trim()) {
      setPopupError('Vui lòng nhập mã OTP')
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
        toastMessage: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      },
    })
  }

  const handleRenewOtp = async () => {
    if (!forgotPasswordUsername.trim()) {
      setPopupError(
        'Không tìm thấy username/email để gửi lại OTP. Vui lòng quay lại bước trước.',
      )
      return
    }

    const response = await apis().post(endpoints.auth.otpForgotPassword, {
      usernameOrEmail: forgotPasswordUsername.trim(),
    })

    const data = extractApiData<AuthForgotPasswordOtpInfo>(response)

    setOtpInfo(data)
    setOtp('')
    setPopupSuccess(data?.message || 'OTP đã được cấp lại thành công')

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
            ? 'Không thể cấp lại OTP, vui lòng thử lại'
            : 'Đặt lại mật khẩu thất bại, vui lòng kiểm tra lại OTP'),
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
      return isOtpExpired ? 'Đang cấp lại OTP...' : 'Đang xác nhận OTP...'
    }

    if (isOtpExpired) {
      return 'OTP đã hết hạn - Cấp lại OTP'
    }

    return `Xác nhận OTP (${countdownText || '00:00'})`
  }, [loading, isOtpExpired, countdownText])

  return (
    <PageTransition>
      {loading && (
        <Loading
          fullScreen
          text={isOtpExpired ? 'Đang cấp lại mã OTP...' : 'Đang cập nhật mật khẩu...'}
        />
      )}

      <section
        className="forgot-password-page-bg forgot-password-page-shell"
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
                      src={vnptLogo}
                      className="forgot-password-brand-image"
                      alt="VNPT Logo"
                    />
                  </div>

                  <div className="forgot-password-divider forgot-password-d-flex forgot-password-align-items-center forgot-password-my-4">
                    <p className="forgot-password-text-center forgot-password-fw-bold forgot-password-mx-3 forgot-password-mb-0">
                      Đặt lại mật khẩu
                    </p>
                  </div>

                  <p className="forgot-password-text-center forgot-password-mb-4 forgot-password-helper-text">
                    Nhập mật khẩu mới, sau đó xác nhận bằng OTP đã gửi về email.
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
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      id="forgotPasswordNew"
                      className="forgot-password-form-control forgot-password-form-control-lg"
                      placeholder="Nhập mật khẩu mới"
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
                      Xác nhận mật khẩu
                    </label>
                    <input
                      type="password"
                      id="forgotPasswordConfirm"
                      className="forgot-password-form-control forgot-password-form-control-lg"
                      placeholder="Nhập lại mật khẩu mới"
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
                      Quay lại bước gửi OTP
                    </button>
                  </div>

                  <div className="forgot-password-text-center forgot-password-mt-4 forgot-password-pt-2">
                    <button
                      type="submit"
                      className="forgot-password-btn forgot-password-btn-primary forgot-password-btn-lg"
                      disabled={loading}
                    >
                      Tiếp tục
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
                <h3 className="forgot-password-modal-title">Xác nhận OTP</h3>
              </div>

              <div className="forgot-password-modal-body">
                {otpInfo?.email && (
                  <p className="forgot-password-modal-subtext forgot-password-modal-email">
                    Email nhận OTP: <strong>{maskedEmail}</strong>
                  </p>
                )}

                {!forgotPasswordUsername && (
                  <div className="forgot-password-alert-danger">
                    Không tìm thấy thông tin tài khoản. Vui lòng quay lại bước gửi OTP.
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
                    Mã OTP
                  </label>
                  <input
                    type="text"
                    id="forgotPasswordOtp"
                    className="forgot-password-form-control forgot-password-form-control-lg"
                    placeholder="Nhập mã OTP"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value)
                      if (popupError) setPopupError('')
                    }}
                    disabled={loading || isOtpExpired || !forgotPasswordUsername}
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
                  Hủy
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
