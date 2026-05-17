import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { apis, endpoints } from '../../../config/apis'
import Loading from '../../../components/loading/Loading'
import PageTransition from '../../../components/transition/PageTransition'
import vnptLogo from '../../../assets/logo/vnpt_logo.png'
import vnptBackground from '../../../assets/logo/vnpt_bg.png'
import './AuthRegisterPage.css'

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Không thể khởi tạo canvas')
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không thể cắt ảnh'))
          return
        }

        const file = new File([blob], 'avatar-cropped.jpg', {
          type: 'image/jpeg',
        })
        resolve(file)
      },
      'image/jpeg',
      0.95,
    )
  })
}

function AuthRegisterPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    gender: 'UNKNOWN',
    email: '',
    phone: '',
  })

  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [showCropModal, setShowCropModal] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ')
      return
    }

    if (error) setError('')
    if (success) setSuccess('')

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result as string)
      setShowCropModal(true)
      setZoom(1)
      setCrop({ x: 0, y: 0 })
      setCroppedAreaPixels(null)
    }
    reader.readAsDataURL(file)

    e.target.value = ''
  }

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels)
    },
    [],
  )

  const handleCloseCropModal = () => {
    setShowCropModal(false)
    setCropImageSrc('')
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setCroppedAreaPixels(null)
  }

  const handleCropSave = async () => {
    try {
      if (!cropImageSrc || !croppedAreaPixels) {
        setError('Không có vùng ảnh để cắt')
        return
      }

      const croppedFile = await getCroppedImg(cropImageSrc, croppedAreaPixels)

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview)
      }

      const previewUrl = URL.createObjectURL(croppedFile)
      setAvatar(croppedFile)
      setAvatarPreview(previewUrl)
      setShowCropModal(false)
      setCropImageSrc('')
      setZoom(1)
      setCrop({ x: 0, y: 0 })
      setCroppedAreaPixels(null)
    } catch {
      setError('Không thể cắt ảnh, vui lòng thử lại')
    }
  }

  const removeAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatar(null)
    setAvatarPreview('')
  }

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Vui lòng nhập tài khoản')
      return false
    }

    if (!formData.password.trim()) {
      setError('Vui lòng nhập mật khẩu')
      return false
    }

    if (!formData.confirmPassword.trim()) {
      setError('Vui lòng nhập xác nhận mật khẩu')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return false
    }

    if (!formData.lastName.trim()) {
      setError('Vui lòng nhập họ')
      return false
    }

    if (!formData.firstName.trim()) {
      setError('Vui lòng nhập tên')
      return false
    }

    if (!formData.email.trim()) {
      setError('Vui lòng nhập email')
      return false
    }

    if (!formData.phone.trim()) {
      setError('Vui lòng nhập số điện thoại')
      return false
    }

    return true
  }

  const handleRegister: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) return

    try {
      setLoading(true)

      const payload = new FormData()
      payload.append('username', formData.username.trim())
      payload.append('password', formData.password.trim())
      payload.append('firstName', formData.firstName.trim())
      payload.append('lastName', formData.lastName.trim())
      payload.append('gender', formData.gender)
      payload.append('email', formData.email.trim())
      payload.append('phone', formData.phone.trim())

      if (avatar) {
        payload.append('avatar', avatar)
      }

      await apis().post(endpoints.auth.register, payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      navigate('/login', {
        replace: true,
        state: {
          toastMessage: 'Đăng ký tài khoản thành công. Vui lòng đăng nhập.',
        },
      })
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      {loading && <Loading fullScreen text="Đang đăng ký tài khoản..." />}

      <section
        className="auth-register-page register-page-bg register-page-shell"
        style={{ backgroundImage: `url(${vnptBackground})` }}
      >
        <div className="register-bg-overlay">
          <div className="register-container-fluid register-h-custom">
            <div className="register-row register-d-flex register-justify-content-center register-align-items-center register-h-100">
              <div className="register-col-md-8 register-col-lg-6 register-col-xl-4">
                <div className="register-scroll-area">
                  <form onSubmit={handleRegister} className="register-form-card">
                    <div className="register-logo-wrap">
                      <img
                        src={vnptLogo}
                        className="register-brand-image"
                        alt="VNPT Logo"
                      />
                    </div>

                    <div className="register-divider register-d-flex register-align-items-center register-my-4">
                      <p className="register-text-center register-fw-bold register-mx-3 register-mb-0">
                        Đăng ký tài khoản
                      </p>
                    </div>

                    {error && (
                      <div className="register-alert-danger">{error}</div>
                    )}
                    {success && (
                      <div className="register-alert-success">{success}</div>
                    )}

                    <div className="register-form-outline register-mb-3">
                      <label
                        className="register-form-label"
                        htmlFor="registerUsername"
                      >
                        Tài khoản
                      </label>
                      <input
                        type="text"
                        id="registerUsername"
                        name="username"
                        className="register-form-control register-form-control-lg"
                        placeholder="Nhập tài khoản"
                        value={formData.username}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="register-form-row register-mb-3">
                      <div className="register-form-col">
                        <label
                          className="register-form-label"
                          htmlFor="registerPassword"
                        >
                          Mật khẩu
                        </label>
                        <input
                          type="password"
                          id="registerPassword"
                          name="password"
                          className="register-form-control register-form-control-lg"
                          placeholder="Nhập mật khẩu"
                          value={formData.password}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="register-form-col">
                        <label
                          className="register-form-label"
                          htmlFor="registerConfirmPassword"
                        >
                          Xác nhận mật khẩu
                        </label>
                        <input
                          type="password"
                          id="registerConfirmPassword"
                          name="confirmPassword"
                          className="register-form-control register-form-control-lg"
                          placeholder="Nhập lại mật khẩu"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="register-form-row register-mb-3">
                      <div className="register-form-col">
                        <label
                          className="register-form-label"
                          htmlFor="registerLastName"
                        >
                          Họ
                        </label>
                        <input
                          type="text"
                          id="registerLastName"
                          name="lastName"
                          className="register-form-control register-form-control-lg"
                          placeholder="Nhập họ"
                          value={formData.lastName}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="register-form-col">
                        <label
                          className="register-form-label"
                          htmlFor="registerFirstName"
                        >
                          Tên
                        </label>
                        <input
                          type="text"
                          id="registerFirstName"
                          name="firstName"
                          className="register-form-control register-form-control-lg"
                          placeholder="Nhập tên"
                          value={formData.firstName}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="register-form-outline register-mb-3">
                      <label
                        className="register-form-label"
                        htmlFor="registerEmail"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="registerEmail"
                        name="email"
                        className="register-form-control register-form-control-lg"
                        placeholder="Nhập email"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="register-form-row register-mb-3">
                      <div className="register-form-col register-form-col-sm">
                        <label
                          className="register-form-label"
                          htmlFor="registerGender"
                        >
                          Giới tính
                        </label>
                        <select
                          id="registerGender"
                          name="gender"
                          className="register-form-control register-form-control-lg"
                          value={formData.gender}
                          onChange={handleChange}
                        >
                          <option value="MALE">Nam</option>
                          <option value="FEMALE">Nữ</option>
                          <option value="OTHER">Khác</option>
                          <option value="UNKNOWN">Không xác định</option>
                        </select>
                      </div>

                      <div className="register-form-col register-form-col-lg">
                        <label
                          className="register-form-label"
                          htmlFor="registerPhone"
                        >
                          Số điện thoại
                        </label>
                        <input
                          type="text"
                          id="registerPhone"
                          name="phone"
                          className="register-form-control register-form-control-lg"
                          placeholder="Nhập số điện thoại"
                          value={formData.phone}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="register-form-outline register-mb-3">
  <label
    className="register-form-label"
    htmlFor="registerAvatar"
  >
    Ảnh đại diện
  </label>

  <div className="register-avatar-row">
    <div className="register-avatar-input-wrap">
      <input
        type="file"
        id="registerAvatar"
        name="avatar"
        accept="image/*"
        className="register-form-control register-form-control-lg register-file-input"
        onChange={handleFileChange}
      />
    </div>

    {avatarPreview && (
      <div className="register-avatar-preview-wrap register-avatar-preview-inline">
        <img
          src={avatarPreview}
          alt="Avatar preview"
          className="register-avatar-preview"
        />

        <div className="register-avatar-actions">
          <span className="register-avatar-crop-text">Cắt ảnh</span>

          <button
            type="button"
            className="register-avatar-remove"
            onClick={removeAvatar}
          >
            Xóa ảnh
          </button>
        </div>
      </div>
    )}
  </div>
</div>

                    <div className="register-form-options register-mb-3">
                      <button
                        type="button"
                        className="register-link-action"
                        onClick={() => navigate('/login')}
                      >
                        Quay lại đăng nhập
                      </button>
                    </div>

                    <div className="register-text-center register-mt-4 register-pt-2">
                      <button
                        type="submit"
                        className="register-btn register-btn-primary register-btn-lg"
                        disabled={loading}
                      >
                        {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCropModal && (
          <div
            className="register-crop-modal-backdrop"
            onClick={handleCloseCropModal}
          >
            <div
              className="register-crop-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="register-crop-header">
                <h3 className="register-crop-title">Cắt ảnh đại diện</h3>
              </div>

              <div className="register-crop-container">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="register-crop-zoom">
                <label htmlFor="registerCropZoom">Phóng to</label>
                <input
                  id="registerCropZoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>

              <div className="register-crop-actions">
                <button
                  type="button"
                  className="register-btn register-btn-secondary"
                  onClick={handleCloseCropModal}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="register-btn register-btn-primary"
                  onClick={handleCropSave}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageTransition>
  )
}

export default AuthRegisterPage
