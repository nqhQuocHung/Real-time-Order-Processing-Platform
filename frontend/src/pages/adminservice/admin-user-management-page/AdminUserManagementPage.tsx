import { useState } from 'react'
import { toast } from 'react-toastify'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './AdminUserManagementPage.css'

type UserProfile = {
  userId: string
  username: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  avatar?: string
  status?: string
  isActive?: boolean
  roles?: string[]
}

type UpdateUserPayload = {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  avatar?: string
  status?: string
  isActive?: boolean
  emailVerified?: boolean
  roleCodes?: string[]
}

function AdminUserManagementPage() {
  const [targetUserId, setTargetUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [roleCodesInput, setRoleCodesInput] = useState('')

  async function loadUserById() {
    if (!targetUserId.trim()) {
      setError('Vui lòng nhập userId.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await apis().get(endpoints.auth.getUserById(targetUserId.trim()))
      const data = extractApiData<UserProfile>(response)
      setProfile(data)
      setRoleCodesInput((data.roles || []).join(', '))
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không tải được thông tin user.'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function updateUser() {
    if (!profile?.userId) {
      toast.error('Vui lòng tải user trước khi cập nhật.')
      return
    }

    const roleCodes = roleCodesInput
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean)

    const payload: UpdateUserPayload = {
      email: profile.email?.trim() || undefined,
      phone: profile.phone?.trim() || undefined,
      firstName: profile.firstName?.trim() || undefined,
      lastName: profile.lastName?.trim() || undefined,
      avatar: profile.avatar?.trim() || undefined,
      status: profile.status || undefined,
      isActive: profile.isActive,
      roleCodes,
    }

    setLoading(true)
    setError('')
    try {
      const response = await apis().patch(endpoints.auth.updateUser(profile.userId), payload)
      const data = extractApiData<{ profile: UserProfile }>(response)
      if (data?.profile) {
        setProfile(data.profile)
        setRoleCodesInput((data.profile.roles || []).join(', '))
      }
      toast.success('Cập nhật user thành công.')
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Không cập nhật được user.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="admin-user-management-page role-page-stack">
      <article className="role-card">
        <h2>Quản lý người dùng</h2>
        <p className="role-muted">
          Admin có thể tra cứu user theo ID và cập nhật thông tin/role trực tiếp.
        </p>

        <div className="role-inline-form">
          <label>
            User ID
            <input
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder="UUID user"
            />
          </label>
        </div>

        <div className="role-inline-actions">
          <button type="button" className="role-btn-primary" onClick={() => void loadUserById()}>
            {loading ? 'Đang xử lý...' : 'Tải user'}
          </button>
        </div>

        {error && <p className="role-error">{error}</p>}
      </article>

      {profile && (
        <article className="role-card">
          <h3>Cập nhật user</h3>
          <div className="role-inline-form">
            <label>
              Username
              <input value={profile.username || ''} disabled />
            </label>
            <label>
              Email
              <input
                value={profile.email || ''}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, email: event.target.value } : prev,
                  )
                }
              />
            </label>
            <label>
              Phone
              <input
                value={profile.phone || ''}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, phone: event.target.value } : prev,
                  )
                }
              />
            </label>
            <label>
              First Name
              <input
                value={profile.firstName || ''}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, firstName: event.target.value } : prev,
                  )
                }
              />
            </label>
            <label>
              Last Name
              <input
                value={profile.lastName || ''}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, lastName: event.target.value } : prev,
                  )
                }
              />
            </label>
            <label>
              Status
              <select
                value={profile.status || 'ACTIVE'}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev ? { ...prev, status: event.target.value } : prev,
                  )
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="DISABLED">DISABLED</option>
                <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
              </select>
            </label>
            <label>
              Is Active
              <select
                value={profile.isActive ? 'true' : 'false'}
                onChange={(event) =>
                  setProfile((prev) =>
                    prev
                      ? { ...prev, isActive: event.target.value === 'true' }
                      : prev,
                  )
                }
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label>
              Role Codes
              <input
                value={roleCodesInput}
                onChange={(event) => setRoleCodesInput(event.target.value)}
                placeholder="USER, ADMIN, SHOPEE_PARTNER"
              />
            </label>
          </div>

          <div className="role-inline-actions">
            <button type="button" className="role-btn-primary" onClick={() => void updateUser()}>
              {loading ? 'Đang cập nhật...' : 'Cập nhật user'}
            </button>
          </div>
        </article>
      )}
    </section>
  )
}

export default AdminUserManagementPage
