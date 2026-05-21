import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getAuthSession } from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
import './UserSupportPage.css'

type SupportFaqItem = {
  id: string
  category: string
  question: string
  answer: string
}

type SelectOption = {
  value: string
  labelKey: string
}

const ISSUE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'ORDER', labelKey: 'pages.userSupport.form.issueTypes.order' },
  { value: 'PAYMENT', labelKey: 'pages.userSupport.form.issueTypes.payment' },
  { value: 'ACCOUNT', labelKey: 'pages.userSupport.form.issueTypes.account' },
  { value: 'SECURITY', labelKey: 'pages.userSupport.form.issueTypes.security' },
  { value: 'TECHNICAL', labelKey: 'pages.userSupport.form.issueTypes.technical' },
  { value: 'OTHER', labelKey: 'pages.userSupport.form.issueTypes.other' },
]

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'LOW', labelKey: 'pages.userSupport.form.priorities.low' },
  { value: 'NORMAL', labelKey: 'pages.userSupport.form.priorities.normal' },
  { value: 'HIGH', labelKey: 'pages.userSupport.form.priorities.high' },
  { value: 'CRITICAL', labelKey: 'pages.userSupport.form.priorities.critical' },
]

function UserSupportPage() {
  const { t } = useI18n()
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

  const supportFaqs = useMemo<SupportFaqItem[]>(
    () => [
      {
        id: 'faq-order-missing',
        category: t('pages.userSupport.faq.items.orderMissing.category'),
        question: t('pages.userSupport.faq.items.orderMissing.question'),
        answer: t('pages.userSupport.faq.items.orderMissing.answer'),
      },
      {
        id: 'faq-cancel-refund',
        category: t('pages.userSupport.faq.items.cancelRefund.category'),
        question: t('pages.userSupport.faq.items.cancelRefund.question'),
        answer: t('pages.userSupport.faq.items.cancelRefund.answer'),
      },
      {
        id: 'faq-address',
        category: t('pages.userSupport.faq.items.address.category'),
        question: t('pages.userSupport.faq.items.address.question'),
        answer: t('pages.userSupport.faq.items.address.answer'),
      },
      {
        id: 'faq-security',
        category: t('pages.userSupport.faq.items.security.category'),
        question: t('pages.userSupport.faq.items.security.question'),
        answer: t('pages.userSupport.faq.items.security.answer'),
      },
      {
        id: 'faq-voucher',
        category: t('pages.userSupport.faq.items.voucher.category'),
        question: t('pages.userSupport.faq.items.voucher.question'),
        answer: t('pages.userSupport.faq.items.voucher.answer'),
      },
    ],
    [t],
  )

  const filteredFaqs = useMemo(() => {
    const keyword = searchFaq.trim().toLowerCase()
    if (!keyword) {
      return supportFaqs
    }

    return supportFaqs.filter((item) =>
      [item.category, item.question, item.answer]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [searchFaq, supportFaqs])

  function handleCreateDraftTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setFormError(t('pages.userSupport.form.errors.invalidEmail'))
      return
    }

    if (!subject.trim()) {
      setFormError(t('pages.userSupport.form.errors.missingSubject'))
      return
    }

    if (details.trim().length < 20) {
      setFormError(t('pages.userSupport.form.errors.detailsTooShort'))
      return
    }

    const emailSubject = `[${issueType}] ${subject.trim()}`
    const emailBodyLines = [
      `${t('pages.userSupport.form.emailBody.priority')}: ${priority}`,
      `${t('pages.userSupport.form.emailBody.orderCode')}: ${orderCode.trim() || 'N/A'}`,
      `${t('pages.userSupport.form.emailBody.contactEmail')}: ${contactEmail.trim()}`,
      '',
      details.trim(),
    ]
    const emailBody = encodeURIComponent(emailBodyLines.join('\n'))
    const mailtoUrl = `mailto:support@platform.local?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`
    window.location.href = mailtoUrl

    setFormSuccess(t('pages.userSupport.form.success.draftCreated'))
  }

  return (
    <section className="user-support-page role-page-stack">
      <article className="role-card user-support-hero">
        <div className="user-support-hero-main">
          <p className="user-support-overline">{t('pages.userSupport.overline')}</p>
          <h2>{t('pages.userSupport.title')}</h2>
          <p className="role-muted">{t('pages.userSupport.subtitle')}</p>
        </div>

        <div className="user-support-hero-badges">
          <div>
            <span>{t('pages.userSupport.badges.normalSla')}</span>
            <strong>&lt; 24h</strong>
          </div>
          <div>
            <span>{t('pages.userSupport.badges.paymentIncident')}</span>
            <strong>&lt; 4h</strong>
          </div>
          <div>
            <span>{t('pages.userSupport.badges.securityIncident')}</span>
            <strong>{t('pages.userSupport.badges.highPriority')}</strong>
          </div>
        </div>
      </article>

      <div className="user-support-grid">
        <article className="role-card user-support-channels">
          <h3>{t('pages.userSupport.quickChannels')}</h3>
          <div className="user-support-channel-list">
            <a className="user-support-channel-card" href="tel:19001234">
              <span>{t('pages.userSupport.channels.hotline')}</span>
              <strong>1900-1234</strong>
              <small>{t('pages.userSupport.channels.hotlineHours')}</small>
            </a>
            <a className="user-support-channel-card" href="mailto:support@platform.local">
              <span>{t('pages.userSupport.channels.email')}</span>
              <strong>support@platform.local</strong>
              <small>{t('pages.userSupport.channels.emailSla')}</small>
            </a>
            <a className="user-support-channel-card" href="mailto:security@platform.local">
              <span>{t('pages.userSupport.channels.securityDesk')}</span>
              <strong>security@platform.local</strong>
              <small>{t('pages.userSupport.channels.securityNote')}</small>
            </a>
          </div>
        </article>

        <article className="role-card user-support-quick-actions">
          <h3>{t('pages.userSupport.selfServiceTitle')}</h3>
          <div className="user-support-action-list">
            <Link className="user-support-action-card" to="/user/orders">
              <strong>{t('pages.userSupport.selfService.orderCheckTitle')}</strong>
              <span>{t('pages.userSupport.selfService.orderCheckNote')}</span>
            </Link>
            <Link className="user-support-action-card" to="/user/profile">
              <strong>{t('pages.userSupport.selfService.accountUpdateTitle')}</strong>
              <span>{t('pages.userSupport.selfService.accountUpdateNote')}</span>
            </Link>
            <Link className="user-support-action-card" to="/user/products">
              <strong>{t('pages.userSupport.selfService.productCheckTitle')}</strong>
              <span>{t('pages.userSupport.selfService.productCheckNote')}</span>
            </Link>
          </div>
        </article>
      </div>

      <article className="role-card user-support-faq">
        <div className="user-support-faq-head">
          <h3>{t('pages.userSupport.faq.title')}</h3>
          <label>
            <span>{t('pages.userSupport.faq.searchLabel')}</span>
            <input
              value={searchFaq}
              onChange={(event) => setSearchFaq(event.target.value)}
              placeholder={t('pages.userSupport.faq.searchPlaceholder')}
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
            <p className="role-empty-cell user-support-faq-empty">{t('pages.userSupport.faq.empty')}</p>
          )}
        </div>
      </article>

      <article className="role-card user-support-ticket">
        <h3>{t('pages.userSupport.form.title')}</h3>
        <p className="role-muted">{t('pages.userSupport.form.subtitle')}</p>

        {formError && <p className="role-error">{formError}</p>}
        {formSuccess && <p className="role-muted user-support-success">{formSuccess}</p>}

        <form
          id="user-support-ticket-form"
          className="role-inline-form user-support-ticket-form"
          onSubmit={handleCreateDraftTicket}
        >
          <label>
            {t('pages.userSupport.form.issueType')}
            <select value={issueType} onChange={(event) => setIssueType(event.target.value)}>
              {ISSUE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('pages.userSupport.form.priority')}
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('pages.userSupport.form.orderCodeOptional')}
            <input
              value={orderCode}
              onChange={(event) => setOrderCode(event.target.value)}
              placeholder={t('pages.userSupport.form.placeholders.orderCode')}
            />
          </label>

          <label>
            {t('pages.userSupport.form.contactEmail')}
            <input
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder={t('pages.userSupport.form.placeholders.contactEmail')}
            />
          </label>

          <label className="user-support-ticket-full">
            {t('pages.userSupport.form.subject')}
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t('pages.userSupport.form.placeholders.subject')}
            />
          </label>

          <label className="user-support-ticket-full">
            {t('pages.userSupport.form.details')}
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              placeholder={t('pages.userSupport.form.placeholders.details')}
            />
          </label>
        </form>

        <div className="role-inline-actions">
          <button type="submit" form="user-support-ticket-form" className="role-btn-primary">
            {t('pages.userSupport.form.createDraft')}
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
            {t('pages.userSupport.form.reset')}
          </button>
        </div>
      </article>
    </section>
  )
}

export default UserSupportPage
