import { useEffect, useState } from 'react'
import { fetchMyProfile } from '../../auth/authSession'
import { extractApiErrorMessage } from '../../config/apis'

type UserProfile = {
  firstName?: string
  lastName?: string
  username: string
  email: string
  phone?: string
  status?: string
  roles?: string[]
}

function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchMyProfile()
        setProfile(data)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được thông tin cá nhân.'))
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [])

  if (loading) {
    return <p className="role-muted">Đang tải thông tin cá nhân...</p>
  }

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Thông tin cá nhân</h2>
        {error && <p className="role-error">{error}</p>}
        {profile && (
          <div className="role-kv-grid">
            <div>
              <span>Họ và tên</span>
              <strong>
                {profile.lastName || ''} {profile.firstName || ''}
              </strong>
            </div>
            <div>
              <span>Username</span>
              <strong>{profile.username}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{profile.email}</strong>
            </div>
            <div>
              <span>Số điện thoại</span>
              <strong>{profile.phone || '-'}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{profile.status || '-'}</strong>
            </div>
            <div>
              <span>Roles</span>
              <strong>{profile.roles?.join(', ') || '-'}</strong>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}

export default UserProfilePage
