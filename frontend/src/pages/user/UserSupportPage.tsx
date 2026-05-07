import RoleFeaturePage from '../shared/RoleFeaturePage'

function UserSupportPage() {
  return (
    <RoleFeaturePage
      title="Hỗ trợ"
      description="Kênh hỗ trợ dành cho người dùng cuối."
      highlights={[
        'Hotline: 1900-xxxx',
        'Email hỗ trợ: support@platform.local',
        'Hướng dẫn xử lý vấn đề đơn hàng',
      ]}
    />
  )
}

export default UserSupportPage
