import { useEffect, useState } from 'react'
import { fetchMyProfile } from '../../auth/authSession'
import { extractApiErrorMessage } from '../../config/apis'

type Profile = {
  username: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  roles?: string[]
  status?: string
}

function PartnerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchMyProfile()
        setProfile(data)
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được hồ sơ partner.'))
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [])

  if (loading) {
    return <p className="role-muted">Đang tải hồ sơ partner...</p>
  }

  return (
    <section className="role-page-stack">
      <article className="role-card">
        <h2>Hồ sơ đối tác</h2>
        {error && <p className="role-error">{error}</p>}
        {profile ? (
          <div className="role-kv-grid">
            <div>
              <span>Tên đối tác</span>
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
              <span>Điện thoại</span>
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
        ) : (
          <p className="role-muted">Không có dữ liệu hồ sơ.</p>
        )}
      </article>
    </section>
  )
}

export default PartnerProfilePage
