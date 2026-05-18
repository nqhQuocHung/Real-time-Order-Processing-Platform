import { useEffect, useMemo, useState } from 'react'
import {
  apis,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
} from '../../../config/apis'
import './AdminReportsPage.css'

type OrderSummary = {
  status: string
  totalAmount: number
}

type OrderListResponse = {
  content: OrderSummary[]
}

function buildPaginationPages(currentPage: number, totalPages: number, maxButtons = 5): number[] {
  if (totalPages <= 0) {
    return []
  }

  const half = Math.floor(maxButtons / 2)
  let start = Math.max(0, currentPage - half)
  let end = Math.min(totalPages - 1, start + maxButtons - 1)

  if (end - start + 1 < maxButtons) {
    start = Math.max(0, end - maxButtons + 1)
  }

  const pages: number[] = []
  for (let i = start; i <= end; i += 1) {
    pages.push(i)
  }

  return pages
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value || 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value || 0)
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildReportPdfHtml(params: {
  generatedAt: string
  totalRevenue: number
  totalOrders: number
  statusEntries: Array<[string, number]>
}) {
  const rows = params.statusEntries.length
    ? params.statusEntries.map(
      ([status, count]) => `
        <tr>
          <td>${escapeHtml(status)}</td>
          <td>${formatNumber(count)}</td>
        </tr>
      `,
    ).join('')
    : `
      <tr>
        <td colspan="2">Chưa có dữ liệu.</td>
      </tr>
    `

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>Bao-cao-he-thong</title>
        <style>
          @page {
            size: A4;
            margin: 16mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            font-family: "Segoe UI", Tahoma, Arial, sans-serif;
            color: #0f172a;
            font-size: 14px;
            line-height: 1.45;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            color: #0b4f7d;
          }
          .muted {
            color: #4b5563;
            margin-top: 6px;
          }
          .meta {
            margin-top: 4px;
            color: #334155;
            font-size: 13px;
          }
          .summary {
            margin-top: 16px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .summary-card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 12px;
            background: #f8fafc;
          }
          .summary-card span {
            display: block;
            color: #475569;
            font-size: 12px;
          }
          .summary-card strong {
            display: block;
            margin-top: 6px;
            font-size: 18px;
            color: #0f172a;
          }
          h2 {
            margin: 22px 0 10px;
            font-size: 18px;
            color: #0b4f7d;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background: #e2e8f0;
            color: #0f172a;
          }
          .footer {
            margin-top: 18px;
            font-size: 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <h1>Báo cáo hệ thống</h1>
        <p class="muted">Báo cáo tổng hợp nhanh theo dữ liệu đơn hàng hiện tại.</p>
        <p class="meta">Thời gian xuất: ${escapeHtml(params.generatedAt)}</p>

        <section class="summary">
          <article class="summary-card">
            <span>Tổng doanh thu</span>
            <strong>${escapeHtml(formatMoney(params.totalRevenue))}</strong>
          </article>
          <article class="summary-card">
            <span>Tổng bản ghi đơn đang tính</span>
            <strong>${escapeHtml(formatNumber(params.totalOrders))}</strong>
          </article>
        </section>

        <h2>Phân bổ trạng thái đơn hàng</h2>
        <table>
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Số lượng</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p class="footer">Gợi ý: Trong hộp thoại in, chọn đích "Save as PDF" để lưu file PDF.</p>

        <script>
          window.addEventListener('load', function () {
            setTimeout(function () {
              window.print();
            }, 120);
          });
        </script>
      </body>
    </html>
  `
}

function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [error, setError] = useState('')
  const [statusPage, setStatusPage] = useState(0)
  const [exportingPdf, setExportingPdf] = useState(false)
  const statusPageSize = 5

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await apis().get(endpoints.orders.list, {
          params: { page: 0, size: 100 },
        })
        const data = extractApiData<OrderListResponse>(response)
        setOrders(data.content || [])
      } catch (err) {
        setError(extractApiErrorMessage(err, 'Không tải được dữ liệu báo cáo.'))
      }
    }

    void loadOrders()
  }, [])

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const order of orders) {
      stats[order.status] = (stats[order.status] || 0) + 1
    }
    return stats
  }, [orders])

  const statusEntries = useMemo(() => {
    return Object.entries(statusStats).sort(([firstStatus], [secondStatus]) =>
      firstStatus.localeCompare(secondStatus),
    )
  }, [statusStats])

  const statusTotalPages = useMemo(() => {
    return statusEntries.length > 0 ? Math.ceil(statusEntries.length / statusPageSize) : 0
  }, [statusEntries.length, statusPageSize])

  useEffect(() => {
    if (statusTotalPages === 0 && statusPage !== 0) {
      setStatusPage(0)
      return
    }

    const maxPage = Math.max(0, statusTotalPages - 1)
    if (statusPage > maxPage) {
      setStatusPage(maxPage)
    }
  }, [statusPage, statusTotalPages])

  const visibleStatusEntries = useMemo(() => {
    const start = statusPage * statusPageSize
    return statusEntries.slice(start, start + statusPageSize)
  }, [statusEntries, statusPage, statusPageSize])

  const paginationPages = useMemo(
    () => buildPaginationPages(statusPage, statusTotalPages),
    [statusPage, statusTotalPages],
  )

  const totalRevenue = useMemo(
    () => orders.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    [orders],
  )

  const statusListStart = statusEntries.length === 0 ? 0 : statusPage * statusPageSize + 1
  const statusListEnd = statusEntries.length === 0
    ? 0
    : Math.min((statusPage + 1) * statusPageSize, statusEntries.length)

  function handleGoToStatusPage(targetPage: number) {
    if (targetPage < 0 || targetPage >= statusTotalPages || targetPage === statusPage) {
      return
    }
    setStatusPage(targetPage)
  }

  function handleExportPdf() {
    setError('')
    setExportingPdf(true)
    try {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer')
      if (!printWindow) {
        setError('Trình duyệt đã chặn popup xuất PDF. Vui lòng cho phép popup và thử lại.')
        return
      }

      const html = buildReportPdfHtml({
        generatedAt: formatDateTime(new Date()),
        totalRevenue,
        totalOrders: orders.length,
        statusEntries,
      })

      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
    } catch {
      setError('Không thể khởi tạo file PDF từ báo cáo.')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <section className="admin-reports-page role-page-stack">
      <article className="role-card">
        <h2>Báo cáo</h2>
        <p className="role-muted">
          Báo cáo nhanh theo dữ liệu đơn hàng hiện tại. Có thể mở rộng biểu đồ khi bổ sung
          endpoint thống kê chuyên dụng.
        </p>
        {error && <p className="role-error">{error}</p>}

        <div className="role-metric-grid">
          <div className="role-metric-card">
            <span>Tổng doanh thu</span>
            <strong>{formatMoney(totalRevenue)}</strong>
          </div>
          <div className="role-metric-card">
            <span>Tổng bản ghi đơn đang tính</span>
            <strong>{orders.length}</strong>
          </div>
        </div>

        <div className="role-inline-actions admin-reports-actions">
          <button
            type="button"
            className="role-btn-primary"
            onClick={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? 'Đang chuẩn bị PDF...' : 'Xuất báo cáo PDF'}
          </button>
        </div>
      </article>

      <article className="role-card">
        <h3>Phân bổ trạng thái đơn hàng</h3>
        <ul className="role-list">
          {visibleStatusEntries.map(([status, count]) => (
            <li key={status}>
              {status}: {count}
            </li>
          ))}
          {!statusEntries.length && <li>Chưa có dữ liệu.</li>}
        </ul>

        <div className="admin-reports-pagination">
          <p className="admin-reports-pagination-summary">
            Showing {statusListStart}-{statusListEnd} of {statusEntries.length}
          </p>
          <div className="admin-reports-pagination-controls">
            <button
              type="button"
              className="role-btn-ghost admin-reports-page-btn"
              onClick={() => handleGoToStatusPage(statusPage - 1)}
              disabled={statusPage <= 0}
            >
              Previous
            </button>
            {paginationPages.map((pageNumber) => (
              <button
                key={`status-page-${pageNumber}`}
                type="button"
                className={`role-btn-ghost admin-reports-page-btn ${pageNumber === statusPage ? 'is-active' : ''}`}
                onClick={() => handleGoToStatusPage(pageNumber)}
              >
                {pageNumber + 1}
              </button>
            ))}
            <button
              type="button"
              className="role-btn-ghost admin-reports-page-btn"
              onClick={() => handleGoToStatusPage(statusPage + 1)}
              disabled={statusPage >= statusTotalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

export default AdminReportsPage
