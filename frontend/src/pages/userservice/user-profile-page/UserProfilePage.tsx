import { useEffect, useRef, useState } from 'react'
import { fetchMyProfile } from '../../../auth/authSession'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  setAuthSession,
} from '../../../config/apis'
import defaultAvatar from '../../../assets/default-avatar.svg'
import './UserProfilePage.css'

type UserProfile = {
  userId: string
  firstName?: string
  lastName?: string
  username: string
  email: string
  phone?: string
  avatar?: string
  status?: string
  roles?: string[]
}

type UserProfileForm = {
  firstName: string
  lastName: string
  phone: string
}

type UpdateUserResponseData = {
  userId: string
  profile: UserProfile
}

function toForm(data: UserProfile): UserProfileForm {
  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    phone: data.phone || '',
  }
}

function normalizeValue(value?: string) {
  return (value || '').trim()
}

function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState<UserProfileForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
  const [avatarUploadFile, setAvatarUploadFile] = useState<File | null>(null)
  const [avatarUploadPreview, setAvatarUploadPreview] = useState('')
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const data = await fetchMyProfile()
        setProfile(data)
        setForm(toForm(data))
      } catch (err) {
        setError(extractApiErrorMessage(err, 'KhÃ´ng táº£i Ä‘Æ°á»£c thÃ´ng tin cÃ¡ nhÃ¢n.'))
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [])

  useEffect(() => {
    return () => {
      if (avatarUploadPreview) {
        URL.revokeObjectURL(avatarUploadPreview)
      }
    }
  }, [avatarUploadPreview])

  const isDirty = Boolean(
    profile &&
      form &&
      (normalizeValue(form.firstName) !== normalizeValue(profile.firstName) ||
        normalizeValue(form.lastName) !== normalizeValue(profile.lastName) ||
        normalizeValue(form.phone) !== normalizeValue(profile.phone)),
  )

  async function handleUpdateProfile() {
    if (!profile || !form || !isDirty) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await apis().patch(endpoints.auth.updateUser(profile.userId), {
        firstName: normalizeValue(form.firstName) || undefined,
        lastName: normalizeValue(form.lastName) || undefined,
        phone: normalizeValue(form.phone) || undefined,
      })

      const data = extractApiData<UpdateUserResponseData>(response)
      const nextProfile = data?.profile || profile

      setProfile(nextProfile)
      setForm(toForm(nextProfile))
      setSuccess('Cáº­p nháº­t thÃ´ng tin thÃ nh cÃ´ng.')
      setAuthSession({
        userId: nextProfile.userId,
        username: nextProfile.username,
        email: nextProfile.email,
      })
      window.dispatchEvent(
        new CustomEvent('auth-profile-updated', {
          detail: {
            avatar: nextProfile.avatar || '',
          },
        }),
      )
    } catch (err) {
      setError(extractApiErrorMessage(err, 'KhÃ´ng thá»ƒ cáº­p nháº­t thÃ´ng tin cÃ¡ nhÃ¢n.'))
    } finally {
      setSaving(false)
    }
  }

  function openAvatarModal() {
    if (avatarUploadPreview) {
      URL.revokeObjectURL(avatarUploadPreview)
    }
    setIsAvatarModalOpen(true)
    setAvatarUploadFile(null)
    setAvatarUploadPreview('')
  }

  function closeAvatarModal() {
    if (avatarUploading) {
      return
    }
    if (avatarUploadPreview) {
      URL.revokeObjectURL(avatarUploadPreview)
    }
    setIsAvatarModalOpen(false)
    setAvatarUploadFile(null)
    setAvatarUploadPreview('')
  }

  function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.')
      return
    }

    if (avatarUploadPreview) {
      URL.revokeObjectURL(avatarUploadPreview)
    }

    setError('')
    setAvatarUploadFile(file)
    setAvatarUploadPreview(URL.createObjectURL(file))
  }

  async function handleUploadAvatar() {
    if (!profile?.userId || !avatarUploadFile) {
      return
    }

    setAvatarUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('avatar', avatarUploadFile)

      const response = await apis().post(
        endpoints.auth.uploadUserAvatar(profile.userId),
        formData,
      )

      const data = extractApiData<UpdateUserResponseData>(response)
      const nextProfile = data?.profile || profile

      setProfile(nextProfile)
      setForm(toForm(nextProfile))
      setSuccess('Avatar updated successfully.')
      setAuthSession({
        userId: nextProfile.userId,
        username: nextProfile.username,
        email: nextProfile.email,
      })
      window.dispatchEvent(
        new CustomEvent('auth-profile-updated', {
          detail: {
            avatar: nextProfile.avatar || '',
          },
        }),
      )
      closeAvatarModal()
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Cannot upload avatar.'))
    } finally {
      setAvatarUploading(false)
    }
  }

  if (loading) {
    return <p className="role-muted">Äang táº£i thÃ´ng tin cÃ¡ nhÃ¢n...</p>
  }

  return (
    <section className="user-profile-page role-page-stack">
      <article className="role-card">
        <h2>ThÃ´ng tin cÃ¡ nhÃ¢n</h2>
        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}
        {profile && form && (
          <>
            <div className="profile-edit-avatar-row">
              <button
                type="button"
                className="profile-edit-avatar-trigger"
                onClick={openAvatarModal}
              >
                <img
                  src={normalizeValue(profile.avatar) || defaultAvatar}
                  alt="Avatar preview"
                  className="profile-edit-avatar-preview"
                  onError={(event) => {
                    event.currentTarget.src = defaultAvatar
                  }}
                />
              </button>
            </div>

            <div className="role-inline-form">
              <label>
                Username
                <input value={profile.username} disabled />
              </label>
              <label>
                Email
                <input value={profile.email} disabled />
              </label>
              <label>
                First name
                <input
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, firstName: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <label>
                Last name
                <input
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, lastName: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <label>
                Sá»‘ Ä‘iá»‡n thoáº¡i
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, phone: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <label>
                NgÃ y sinh
                <input value="ChÆ°a há»— trá»£ tá»« backend" disabled />
              </label>
              <label>
                Tráº¡ng thÃ¡i
                <input value={profile.status || '-'} disabled />
              </label>
              <label>
                Roles
                <input value={profile.roles?.join(', ') || '-'} disabled />
              </label>
            </div>

            <div className="role-inline-actions profile-actions">
              {isDirty && (
                <button
                  type="button"
                  className="role-btn-primary"
                  onClick={() => void handleUpdateProfile()}
                  disabled={saving}
                >
                  {saving ? 'Äang cáº­p nháº­t...' : 'Cáº­p nháº­t'}
                </button>
              )}
            </div>
          </>
        )}
      </article>

      {isAvatarModalOpen && (
        <div className="profile-avatar-modal-backdrop" onClick={closeAvatarModal}>
          <div
            className="profile-avatar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Change avatar</h3>
            <div className="profile-avatar-modal-preview-wrap">
              <img
                src={
                  avatarUploadPreview ||
                  normalizeValue(profile?.avatar) ||
                  defaultAvatar
                }
                alt="Avatar selected preview"
                className="profile-avatar-modal-preview"
                onError={(event) => {
                  event.currentTarget.src = defaultAvatar
                }}
              />
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="profile-avatar-file-input"
              onChange={handleAvatarFileChange}
            />
            <div className="profile-avatar-modal-actions">
              <button
                type="button"
                className="role-btn-ghost"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                Choose image
              </button>
              <button
                type="button"
                className="role-btn-primary"
                onClick={() => void handleUploadAvatar()}
                disabled={!avatarUploadFile || avatarUploading}
              >
                {avatarUploading ? 'Uploading...' : 'Save avatar'}
              </button>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeAvatarModal}
                disabled={avatarUploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default UserProfilePage
