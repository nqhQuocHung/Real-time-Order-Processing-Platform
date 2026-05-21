import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../../../config/apis'
import { useI18n } from '../../../i18n/I18nProvider'
import './PartnerRevenueReportPage.css'

type OrderSummary = {
  status: string
  totalAmount: number
  currency: string
}

type OrderListResponse = {
  content: OrderSummary[]
}

function formatMoney(value: number, currency = 'VND', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value || 0)
}

function PartnerRevenueReportPage() {
  const { language, t } = useI18n()
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  const session = getAuthSession()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOrders() {
      if (!session?.userId) {
        setError(t('pages.partnerRevenueReport.errors.missingUserId', 'No userId found in session.'))
        return
      }

      try {
        const response = await apis().get(endpoints.orders.list, {
          params: {
            customerId: session.userId,
            page: 0,
            size: 100,
          },
        })
        const data = extractApiData<OrderListResponse>(response)
        setOrders(data.content || [])
      } catch (err) {
        setError(
          extractApiErrorMessage(
            err,
            t('pages.partnerRevenueReport.errors.loadFailed', 'Cannot load revenue report.'),
          ),
        )
      }
    }

    void loadOrders()
  }, [session?.userId, t])

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  const completedOrders = useMemo(
    () => orders.filter((item) => item.status === 'COMPLETED').length,
    [orders],
  )

  return (
    <section className="partner-revenue-report-page role-page-stack">
      <article className="role-card">
        <h2>{t('pages.partnerRevenueReport.title', 'Revenue report')}</h2>
        <p className="role-muted">
          {t(
            'pages.partnerRevenueReport.subtitle',
            'Analyze revenue by period, order status, and products.',
          )}
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>{t('pages.partnerRevenueReport.totalRevenue', 'Total revenue')}</span>
            <strong>{formatMoney(totalRevenue, orders[0]?.currency || 'VND', locale)}</strong>
          </div>
          <div className="role-metric-card">
            <span>{t('pages.partnerRevenueReport.completedOrders', 'Completed Orders')}</span>
            <strong>{completedOrders}</strong>
          </div>
          <div className="role-metric-card">
            <span>{t('pages.partnerRevenueReport.totalCountedOrders', 'Total Counted Orders')}</span>
            <strong>{orders.length}</strong>
          </div>
        </div>
      </article>
    </section>
  )
}

export default PartnerRevenueReportPage
