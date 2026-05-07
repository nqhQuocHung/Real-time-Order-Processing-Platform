import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apis, endpoints, extractApiData } from '../../../config/apis'
import vnptLogo from '../../../assets/logo/vnpt_logo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import Loading from '../../../components/loading/Loading'
import PageTransition from '../../../components/transition/PageTransition'
import './AuthForgotPasswordOtpPage.css'

type AuthForgotPasswordOtpData = {
  userId: string
  email?: string
  expiresAt?: string
  message?: string
}

function AuthForgotPasswordOtpPage() {
  const navigate = useNavigate()

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendOtp: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!usernameOrEmail.trim()) {
      setError('Vui lòng nhập tài khoản hoặc email')
      return
    }

    try {
      setLoading(true)

      const response = await apis().post(endpoints.auth.otpForgotPassword, {
        usernameOrEmail: usernameOrEmail.trim(),
      })

      const data = extractApiData<AuthForgotPasswordOtpData>(response)

      setSuccess(data.message || 'OTP đã được gửi thành công')

      localStorage.setItem('forgotPasswordUsername', usernameOrEmail.trim())
      localStorage.setItem('forgotPasswordOtpInfo', JSON.stringify(data))

      navigate('/forgot-password')
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Không thể gửi OTP, vui lòng thử lại',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      {loading && <Loading fullScreen text="Đang gửi OTP..." />}

      <section
        className="auth-forgot-password-otp-page forgot-password-otp-vh-100 forgot-password-otp-page-bg"
        style={{ backgroundImage: `url(${vnptBackground})` }}
      >
        <div className="forgot-password-otp-bg-overlay">
          <div className="forgot-password-otp-container-fluid forgot-password-otp-h-custom">
            <div className="forgot-password-otp-row forgot-password-otp-d-flex forgot-password-otp-justify-content-center forgot-password-otp-align-items-center forgot-password-otp-h-100">
              <div className="forgot-password-otp-col-md-8 forgot-password-otp-col-lg-6 forgot-password-otp-col-xl-4">
                <form
                  onSubmit={handleSendOtp}
                  className="forgot-password-otp-form-card"
                >
                  <div className="forgot-password-otp-logo-wrap">
                    <img
                      src={vnptLogo}
                      className="forgot-password-otp-brand-image"
                      alt="VNPT Logo"
                    />
                  </div>

                  <div className="forgot-password-otp-divider forgot-password-otp-d-flex forgot-password-otp-align-items-center forgot-password-otp-my-4">
                    <p className="forgot-password-otp-text-center forgot-password-otp-fw-bold forgot-password-otp-mx-3 forgot-password-otp-mb-0">
                      Quên mật khẩu
                    </p>
                  </div>

                  <p className="forgot-password-otp-text-center forgot-password-otp-mb-4">
                    Nhập tài khoản hoặc email để nhận mã OTP đặt lại mật khẩu
                  </p>

                  {error && (
                    <div className="forgot-password-otp-alert-danger">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="forgot-password-otp-alert-success">
                      {success}
                    </div>
                  )}

                  <div className="forgot-password-otp-form-outline forgot-password-otp-mb-4">
                    <label
                      className="forgot-password-otp-form-label"
                      htmlFor="forgotUsernameOrEmail"
                    >
                      Tài khoản hoặc email
                    </label>
                    <input
                      type="text"
                      id="forgotUsernameOrEmail"
                      className="forgot-password-otp-form-control forgot-password-otp-form-control-lg"
                      placeholder="Nhập tài khoản hoặc email"
                      value={usernameOrEmail}
                      onChange={(e) => {
                        setUsernameOrEmail(e.target.value)
                        if (error) setError('')
                        if (success) setSuccess('')
                      }}
                    />
                  </div>

                  <div className="forgot-password-otp-d-flex forgot-password-otp-justify-content-between forgot-password-otp-align-items-center forgot-password-otp-mb-3 forgot-password-otp-form-options">
                    <div className="forgot-password-otp-form-register forgot-password-otp-mb-0">
                      <button
                        type="button"
                        className="forgot-password-otp-link-action"
                        onClick={() => navigate('/login')}
                      >
                        Quay lại đăng nhập
                      </button>
                    </div>
                  </div>

                  <div className="forgot-password-otp-text-center forgot-password-otp-mt-4 forgot-password-otp-pt-2">
                    <button
                      type="submit"
                      className="forgot-password-otp-btn forgot-password-otp-btn-primary forgot-password-otp-btn-lg"
                      disabled={loading}
                    >
                      {loading ? 'Đang gửi OTP...' : 'Gửi OTP'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}

export default AuthForgotPasswordOtpPage
