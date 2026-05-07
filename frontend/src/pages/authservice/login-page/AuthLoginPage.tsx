import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { completeLoginSession, type LoginResponseData } from '../../../auth/authSession'
import { getDefaultPathByRole } from '../../../config/roleConfig'
import { apis, endpoints, extractApiData, extractApiErrorMessage } from '../../../config/apis'
import vnptLogo from '../../../assets/logo/vnpt_logo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import Loading from '../../../components/loading/Loading'
import PageTransition from '../../../components/transition/PageTransition'
import './AuthLoginPage.css'

type LoginLocationState = {
  toastMessage?: string
}

function AuthLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const state = location.state as LoginLocationState | null

    if (state?.toastMessage) {
      toast.success(state.toastMessage, { toastId: 'login-toast-message' })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  const handleLogin: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.')
      return
    }

    try {
      setLoading(true)
      const response = await apis().post(endpoints.auth.login, {
        usernameOrEmail: username.trim(),
        password: password.trim(),
      })

      const loginData = extractApiData<LoginResponseData>(response)
      const { role } = await completeLoginSession(loginData)

      navigate(getDefaultPathByRole(role), { replace: true })
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Tài khoản hoặc mật khẩu không đúng.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      {loading && <Loading fullScreen text="Đang đăng nhập..." />}

      <section
        className="auth-login-page login-vh-100 login-page-bg"
        style={{ backgroundImage: `url(${vnptBackground})` }}
      >
        <div className="login-bg-overlay">
          <div className="login-container-fluid login-h-custom">
            <div className="login-row login-d-flex login-justify-content-center login-align-items-center login-h-100">
              <div className="login-col-md-8 login-col-lg-6 login-col-xl-4">
                <form onSubmit={handleLogin} className="login-form-card">
                  <div className="login-logo-wrap">
                    <img
                      src={vnptLogo}
                      className="login-brand-image"
                      alt="VNPT Logo"
                    />
                  </div>

                  <div className="login-divider login-d-flex login-align-items-center login-my-4">
                    <p className="login-text-center login-fw-bold login-mx-3 login-mb-0">
                      Đăng nhập hệ thống
                    </p>
                  </div>

                  {error && <div className="login-alert-danger">{error}</div>}

                  <div className="login-form-outline login-mb-4">
                    <label className="login-form-label" htmlFor="loginUsername">
                      Tài khoản
                    </label>
                    <input
                      type="text"
                      id="loginUsername"
                      className="login-form-control login-form-control-lg"
                      placeholder="Nhập tài khoản"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        if (error) setError('')
                      }}
                    />
                  </div>

                  <div className="login-form-outline login-mb-3">
                    <label className="login-form-label" htmlFor="loginPassword">
                      Mật khẩu
                    </label>
                    <input
                      type="password"
                      id="loginPassword"
                      className="login-form-control login-form-control-lg"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError('')
                      }}
                    />
                  </div>

                  <div className="login-d-flex login-justify-content-between login-align-items-center login-mb-3 login-form-options">
                    <div className="login-form-register login-mb-0">
                      <button
                        type="button"
                        className="login-link-action"
                        onClick={() => navigate('/register')}
                      >
                        Đăng ký tài khoản
                      </button>
                    </div>

                    <div className="login-form-forget login-mb-0">
                      <button
                        type="button"
                        className="login-link-action"
                        onClick={() => navigate('/forgot-password-otp')}
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                  </div>

                  <div className="login-text-center login-mt-4 login-pt-2">
                    <button
                      type="submit"
                      className="login-btn login-btn-primary login-btn-lg"
                      disabled={loading}
                    >
                      {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
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

export default AuthLoginPage
