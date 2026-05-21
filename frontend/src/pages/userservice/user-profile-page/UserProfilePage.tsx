import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { fetchMyProfile } from '../../../auth/authSession'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  setAuthSession,
} from '../../../config/apis'
import defaultAvatar from '../../../assets/default-avatar.svg'
import { useI18n } from '../../../i18n/I18nProvider'
import './UserProfilePage.css'

type UserProfile = {
  userId: string
  uuid?: string
  firstName?: string
  lastName?: string
  username: string
  email: string
  phone?: string
  avatar?: string
  status?: string
  emailVerified?: boolean
  failedLoginCount?: number
  lastLoginAt?: string
  gender?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
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

function formatDateTime(value?: string) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString('vi-VN')
}

function formatBoolean(value?: boolean) {
  if (typeof value !== 'boolean') {
    return '-'
  }
  return value ? 'true' : 'false'
}

function UserProfilePage() {
  const { t } = useI18n()
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
        setError(
          extractApiErrorMessage(
            err,
            t('pages.userProfile.errors.loadFailed', 'Cannot load profile information.'),
          ),
        )
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [t])

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
      setSuccess(t('pages.userProfile.success.profileUpdated', 'Profile updated successfully.'))
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
      setError(
        extractApiErrorMessage(
          err,
          t('pages.userProfile.errors.updateFailed', 'Cannot update profile information.'),
        ),
      )
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

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setError(t('pages.userProfile.errors.invalidImage', 'Only image files are allowed.'))
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
      setSuccess(t('pages.userProfile.success.avatarUpdated', 'Avatar updated successfully.'))
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
      setError(
        extractApiErrorMessage(
          err,
          t('pages.userProfile.errors.uploadAvatarFailed', 'Cannot upload avatar.'),
        ),
      )
    } finally {
      setAvatarUploading(false)
    }
  }

  if (loading) {
    return (
      <p className="role-muted">
        {t('pages.userProfile.loading', 'Loading profile information...')}
      </p>
    )
  }

  return (
    <section className="user-profile-page role-page-stack">
      <article className="role-card">
        <h2>{t('pages.userProfile.title', 'My profile')}</h2>
        {error && <p className="role-error">{error}</p>}
        {success && <p className="role-muted">{success}</p>}
        {profile && form && (
          <>
            <div className="profile-edit-avatar-row">
              <button
                type="button"
                className="profile-edit-avatar-trigger"
                onClick={openAvatarModal}
                title={t('pages.userProfile.changeAvatar', 'Change avatar')}
              >
                <img
                  src={normalizeValue(profile.avatar) || defaultAvatar}
                  alt={t('pages.userProfile.avatarPreview', 'Avatar preview')}
                  className="profile-edit-avatar-preview"
                  onError={(event) => {
                    event.currentTarget.src = defaultAvatar
                  }}
                />
              </button>
            </div>

            <div className="user-profile-sections">
              <h3 className="user-profile-subtitle">
                {t('pages.userProfile.sections.editable', 'Editable information')}
              </h3>

              <div className="role-inline-form user-profile-editable-grid">
                <label>
                  {t('pages.userProfile.firstName', 'First name')}
                  <input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))
                    }
                  />
                </label>
                <label>
                  {t('pages.userProfile.lastName', 'Last name')}
                  <input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))
                    }
                  />
                </label>
                <label>
                  {t('pages.userProfile.phone', 'Phone')}
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))
                    }
                  />
                </label>
              </div>

              {isDirty && (
                <div className="role-inline-actions profile-actions">
                  <button
                    type="button"
                    className="role-btn-primary"
                    onClick={() => void handleUpdateProfile()}
                    disabled={saving}
                  >
                    {saving
                      ? t('pages.userProfile.actions.updating', 'Updating...')
                      : t('pages.userProfile.updateProfile', 'Update profile')}
                  </button>
                </div>
              )}

              <h3 className="user-profile-subtitle user-profile-subtitle-system">
                {t('pages.userProfile.sections.system', 'System information')}
              </h3>

              <div className="role-inline-form user-profile-readonly-grid">
              <label>
                {t('pages.userProfile.userId', 'User ID')}
                <input value={profile.userId || '-'} disabled />
              </label>
              <label>
                {t('pages.userProfile.uuid', 'UUID')}
                <input value={profile.uuid || '-'} disabled />
              </label>
              <label>
                {t('pages.userProfile.username', 'Username')}
                <input value={profile.username} disabled />
              </label>
              <label>
                {t('pages.userProfile.email', 'Email')}
                <input value={profile.email} disabled />
              </label>
              <label>
                {t('pages.userProfile.gender', 'Gender')}
                <input value={profile.gender || '-'} disabled />
              </label>
              <label>
                {t('pages.userProfile.status', 'Status')}
                <input value={profile.status || '-'} disabled />
              </label>
              <label>
                {t('pages.userProfile.failedLoginCount', 'Failed login count')}
                <input value={String(profile.failedLoginCount ?? '-')} disabled />
              </label>
              <label>
                {t('pages.userProfile.lastLoginAt', 'Last login at')}
                <input value={formatDateTime(profile.lastLoginAt)} disabled />
              </label>
              <label>
                {t('pages.userProfile.createdAt', 'Created at')}
                <input value={formatDateTime(profile.createdAt)} disabled />
              </label>
              <label>
                {t('pages.userProfile.updatedAt', 'Updated at')}
                <input value={formatDateTime(profile.updatedAt)} disabled />
              </label>
              <label>
                {t('pages.userProfile.roles', 'Roles')}
                <input value={profile.roles?.join(', ') || '-'} disabled />
              </label>
              </div>
            </div>
          </>
        )}
      </article>

      {isAvatarModalOpen && (
        <div className="profile-avatar-modal-backdrop" onClick={closeAvatarModal}>
          <div className="profile-avatar-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{t('pages.userProfile.changeAvatar', 'Change avatar')}</h3>
            <div className="profile-avatar-modal-preview-wrap">
              <img
                src={avatarUploadPreview || normalizeValue(profile?.avatar) || defaultAvatar}
                alt={t('pages.userProfile.avatarSelectedPreview', 'Avatar selected preview')}
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
                {t('pages.userProfile.actions.chooseImage', 'Choose image')}
              </button>
              <button
                type="button"
                className="role-btn-primary"
                onClick={() => void handleUploadAvatar()}
                disabled={!avatarUploadFile || avatarUploading}
              >
                {avatarUploading
                  ? t('pages.userProfile.actions.uploading', 'Uploading...')
                  : t('pages.userProfile.actions.saveAvatar', 'Save avatar')}
              </button>
              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeAvatarModal}
                disabled={avatarUploading}
              >
                {t('pages.userProfile.actions.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default UserProfilePage
