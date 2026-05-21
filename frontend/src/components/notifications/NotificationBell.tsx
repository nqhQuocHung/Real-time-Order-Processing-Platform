import { forwardRef } from 'react'
import './NotificationBell.css'

type TranslateFn = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) => string

type NotificationItem = {
  id: string
  title: string
  message: string
  eventType?: string
  occurredAt: string
  link?: string
  linkHint?: string
}

type NotificationBellProps = {
  compact?: boolean
  isOpen: boolean
  language: 'en' | 'vi'
  notifications: NotificationItem[]
  onItemClick: (item: NotificationItem) => void
  onToggle: () => void
  t: TranslateFn
  unreadCount: number
}

function formatOccurredAt(value: string, language: 'en' | 'vi') {
  if (!value) {
    return '-'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

const NotificationBell = forwardRef<HTMLDivElement, NotificationBellProps>(
  function NotificationBell(
    {
      compact = false,
      isOpen,
      language,
      notifications,
      onItemClick,
      onToggle,
      t,
      unreadCount,
    },
    ref,
  ) {
    return (
      <div
        className={`role-notification-menu ${compact ? 'role-notification-menu-compact' : ''}`}
        ref={ref}
      >
        <button
          type="button"
          className={`role-notification-trigger ${isOpen ? 'open' : ''}`}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={t('notificationBell.openAria', 'Open notification list')}
        >
          <span className="role-notification-bell" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 2a6 6 0 0 0-6 6v3.8l-1.7 2.6a1.5 1.5 0 0 0 1.3 2.3h12.8a1.5 1.5 0 0 0 1.3-2.3L18 11.8V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.8-2h-5.6A3 3 0 0 0 12 22Z" />
            </svg>
          </span>
          {unreadCount > 0 && (
            <span className="role-notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="role-notification-dropdown">
            <div className="role-notification-dropdown-header">
              <strong>{t('notificationBell.header', 'Notifications')}</strong>
              <span>{notifications.length}</span>
            </div>
            {notifications.length === 0 ? (
              <p className="role-notification-empty">
                {t('notificationBell.empty', 'No notifications yet.')}
              </p>
            ) : (
              <ul className="role-notification-list">
                {notifications.map((item) => {
                  return (
                    <li
                      key={item.id}
                      className={`role-notification-item ${item.link ? 'is-clickable' : ''}`}
                      onClick={() => item.link && onItemClick(item)}
                      onKeyDown={(event) => {
                        if (!item.link) {
                          return
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onItemClick(item)
                        }
                      }}
                      tabIndex={item.link ? 0 : -1}
                      role={item.link ? 'button' : undefined}
                      aria-label={
                        item.link
                          ? t('notificationBell.openItemAria', 'Open notification: {title}', {
                              title: item.title,
                            })
                          : undefined
                      }
                    >
                      <p className="role-notification-title">{item.title}</p>
                      <p className="role-notification-message">{item.message}</p>
                      <div className="role-notification-meta role-notification-meta-time-only">
                        <time dateTime={item.occurredAt}>
                          {formatOccurredAt(item.occurredAt, language)}
                        </time>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  },
)

export default NotificationBell
export type { NotificationItem }
