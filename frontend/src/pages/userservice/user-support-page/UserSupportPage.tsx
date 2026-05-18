import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getAuthSession } from '../../../config/apis'
import './UserSupportPage.css'

type SupportFaqItem = {
  id: string
  category: string
  question: string
  answer: string
}

const SUPPORT_FAQS: SupportFaqItem[] = [
  {
    id: 'faq-order-missing',
    category: 'Order',
    question: 'Tôi đã thanh toán nhưng đơn chưa hiển thị thì làm gì?',
    answer:
      'Vào trang Orders, lọc theo thời gian gần nhất và kiểm tra trạng thái PAYMENT_PENDING hoặc PROCESSING. Nếu sau 15 phút vẫn không có đơn, gửi ticket kèm mã giao dịch và thời gian thanh toán.',
  },
  {
    id: 'faq-cancel-refund',
    category: 'Refund',
    question: 'Hủy đơn rồi thì bao lâu được hoàn tiền?',
    answer:
      'Thời gian hoàn tiền phụ thuộc cổng thanh toán và ngân hàng, thường 3-7 ngày làm việc. Với ví điện tử thường nhanh hơn. Bạn nên lưu mã đơn hàng để support tra soát chính xác.',
  },
  {
    id: 'faq-address',
    category: 'Account',
    question: 'Làm sao cập nhật thông tin nhận hàng?',
    answer:
      'Hiện tại bạn có thể cập nhật thông tin cá nhân tại Profile. Nếu cần đổi địa chỉ cho đơn đã tạo, hãy tạo yêu cầu support ngay trước khi đơn chuyển sang SHIPPING.',
  },
  {
    id: 'faq-security',
    category: 'Security',
    question: 'Tôi nghi ngờ tài khoản bị đăng nhập lạ.',
    answer:
      'Đổi mật khẩu ngay tại trang Profile, sau đó đăng xuất trên các thiết bị khác. Nếu có giao dịch bất thường, gửi ticket với tiêu đề "Security Incident" để ưu tiên xử lý.',
  },
  {
    id: 'faq-voucher',
    category: 'Promotion',
    question: 'Mã giảm giá không áp dụng được dù còn hạn.',
    answer:
      'Kiểm tra điều kiện áp dụng: ngành hàng, giá trị đơn tối thiểu, số lần dùng và trạng thái tài khoản. Nếu vẫn lỗi, gửi mã voucher + ảnh chụp màn hình bước thanh toán.',
  },
]

function UserSupportPage() {
  const session = getAuthSession()
  const [searchFaq, setSearchFaq] = useState('')
  const [issueType, setIssueType] = useState('ORDER')
  const [priority, setPriority] = useState('NORMAL')
  const [orderCode, setOrderCode] = useState('')
  const [contactEmail, setContactEmail] = useState(session?.email || '')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const filteredFaqs = useMemo(() => {
    const keyword = searchFaq.trim().toLowerCase()
    if (!keyword) {
      return SUPPORT_FAQS
    }

    return SUPPORT_FAQS.filter((item) =>
      [item.category, item.question, item.answer]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [searchFaq])

  function handleCreateDraftTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setFormError('Vui lòng nhập email liên hệ hợp lệ.')
      return
    }

    if (!subject.trim()) {
      setFormError('Vui lòng nhập tiêu đề yêu cầu hỗ trợ.')
      return
    }

    if (details.trim().length < 20) {
      setFormError('Mô tả cần tối thiểu 20 ký tự để support xử lý nhanh hơn.')
      return
    }

    const emailSubject = `[${issueType}] ${subject.trim()}`
    const emailBodyLines = [
      `Priority: ${priority}`,
      `Order code: ${orderCode.trim() || 'N/A'}`,
      `Contact email: ${contactEmail.trim()}`,
      '',
      details.trim(),
    ]
    const emailBody = encodeURIComponent(emailBodyLines.join('\n'))
    const mailtoUrl = `mailto:support@platform.local?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`
    window.location.href = mailtoUrl

    setFormSuccess('Đã tạo ticket nháp qua email client. Vui lòng gửi email để hoàn tất.')
  }

  return (
    <section className="user-support-page role-page-stack">
      <article className="role-card user-support-hero">
        <div className="user-support-hero-main">
          <p className="user-support-overline">Help Center</p>
          <h2>User Support Workspace</h2>
          <p className="role-muted">
            Hỗ trợ vấn đề đơn hàng, thanh toán, tài khoản và kỹ thuật. Ưu tiên xử lý dựa trên
            mức độ ảnh hưởng và thông tin bạn cung cấp.
          </p>
        </div>

        <div className="user-support-hero-badges">
          <div>
            <span>SLA thường</span>
            <strong>&lt; 24h</strong>
          </div>
          <div>
            <span>Sự cố thanh toán</span>
            <strong>&lt; 4h</strong>
          </div>
          <div>
            <span>Sự cố bảo mật</span>
            <strong>Ưu tiên cao</strong>
          </div>
        </div>
      </article>

      <div className="user-support-grid">
        <article className="role-card user-support-channels">
          <h3>Kênh hỗ trợ nhanh</h3>
          <div className="user-support-channel-list">
            <a className="user-support-channel-card" href="tel:19001234">
              <span>Hotline</span>
              <strong>1900-1234</strong>
              <small>08:00 - 22:00 mỗi ngày</small>
            </a>
            <a className="user-support-channel-card" href="mailto:support@platform.local">
              <span>Email</span>
              <strong>support@platform.local</strong>
              <small>Phản hồi theo SLA</small>
            </a>
            <a className="user-support-channel-card" href="mailto:security@platform.local">
              <span>Security Desk</span>
              <strong>security@platform.local</strong>
              <small>Dành cho sự cố bảo mật</small>
            </a>
          </div>
        </article>

        <article className="role-card user-support-quick-actions">
          <h3>Tự xử lý nhanh</h3>
          <div className="user-support-action-list">
            <Link className="user-support-action-card" to="/user/orders">
              <strong>Kiểm tra đơn hàng</strong>
              <span>Theo dõi timeline đơn và trạng thái thanh toán</span>
            </Link>
            <Link className="user-support-action-card" to="/user/profile">
              <strong>Cập nhật tài khoản</strong>
              <span>Đổi mật khẩu và thông tin cá nhân</span>
            </Link>
            <Link className="user-support-action-card" to="/user/products">
              <strong>Kiểm tra sản phẩm</strong>
              <span>Xem lại giá, tồn kho và điều kiện mua</span>
            </Link>
          </div>
        </article>
      </div>

      <article className="role-card user-support-faq">
        <div className="user-support-faq-head">
          <h3>FAQ & Troubleshooting</h3>
          <label>
            <span>Tìm nhanh</span>
            <input
              value={searchFaq}
              onChange={(event) => setSearchFaq(event.target.value)}
              placeholder="Nhập từ khóa: thanh toán, hoàn tiền..."
            />
          </label>
        </div>

        <div className="user-support-faq-list">
          {filteredFaqs.map((faq) => (
            <details key={faq.id} className="user-support-faq-item">
              <summary>
                <small>{faq.category}</small>
                <strong>{faq.question}</strong>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
          {!filteredFaqs.length && (
            <p className="role-empty-cell user-support-faq-empty">
              Không tìm thấy câu trả lời phù hợp. Hãy tạo ticket bên dưới.
            </p>
          )}
        </div>
      </article>

      <article className="role-card user-support-ticket">
        <h3>Tạo ticket hỗ trợ</h3>
        <p className="role-muted">
          Cung cấp càng nhiều thông tin (mã đơn, thời gian, ảnh lỗi) thì xử lý càng nhanh.
        </p>

        {formError && <p className="role-error">{formError}</p>}
        {formSuccess && <p className="role-muted user-support-success">{formSuccess}</p>}

        <form
          id="user-support-ticket-form"
          className="role-inline-form user-support-ticket-form"
          onSubmit={handleCreateDraftTicket}
        >
          <label>
            Loại yêu cầu
            <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
              <option value="ORDER">Order</option>
              <option value="PAYMENT">Payment</option>
              <option value="ACCOUNT">Account</option>
              <option value="SECURITY">Security</option>
              <option value="TECHNICAL">Technical</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label>
            Mức độ ưu tiên
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>

          <label>
            Mã đơn hàng (nếu có)
            <input
              value={orderCode}
              onChange={(event) => setOrderCode(event.target.value)}
              placeholder="Ex: ORD-2026-000123"
            />
          </label>

          <label>
            Email liên hệ
            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="user-support-ticket-full">
            Tiêu đề
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Mô tả ngắn vấn đề"
            />
          </label>

          <label className="user-support-ticket-full">
            Chi tiết
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              placeholder="Mô tả bước thao tác, thông báo lỗi, thời gian xảy ra..."
            />
          </label>
        </form>

        <div className="role-inline-actions">
          <button type="submit" form="user-support-ticket-form" className="role-btn-primary">
            Create Draft Ticket
          </button>
          <button
            type="button"
            className="role-btn-ghost"
            onClick={() => {
              setIssueType('ORDER')
              setPriority('NORMAL')
              setOrderCode('')
              setContactEmail(session?.email || '')
              setSubject('')
              setDetails('')
              setFormError('')
              setFormSuccess('')
            }}
          >
            Reset Form
          </button>
        </div>
      </article>
    </section>
  )
}

export default UserSupportPage
