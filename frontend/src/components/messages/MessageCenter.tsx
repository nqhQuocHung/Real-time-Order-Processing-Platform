import { forwardRef } from 'react'
import defaultAvatar from '../../assets/default-avatar.svg'
import './MessageCenter.css'

export type MessageConversationItem = {
  conversationId: string
  userId: string
  userDisplayName?: string
  partnerId: string
  partnerDisplayName?: string
  productId?: string
  productName?: string
  lastMessagePreview?: string
  lastMessageSenderId?: string
  lastMessageSenderName?: string
  lastMessageAt?: string
  unreadCount?: number
}

export type MessageEntryItem = {
  messageId: string
  conversationId: string
  senderId: string
  senderRole?: string
  senderName?: string
  recipientId?: string
  content: string
  createdAt?: string
  updatedAt?: string
}

type MessageCenterProps = {
  compact?: boolean
  isOpen: boolean
  isThreadOpen: boolean
  error?: string
  unreadCount: number
  conversations: MessageConversationItem[]
  activeConversationId: string
  messages: MessageEntryItem[]
  currentUserId: string
  currentUserAvatar?: string
  avatarByUserId?: Record<string, string>
  draft: string
  sending: boolean
  loadingConversations: boolean
  loadingMessages: boolean
  onToggle: () => void
  onSelectConversation: (conversationId: string) => void
  onCloseThread: () => void
  onDraftChange: (value: string) => void
  onSend: () => void
}

function formatOccurredAt(value?: string) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function toDateBucket(value?: string) {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`
}

function formatDateDivider(value?: string) {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function resolveConversationTitle(conversation: MessageConversationItem, currentUserId: string) {
  const isUserSide = currentUserId === conversation.userId
  const defaultTitle = isUserSide ? conversation.partnerId : conversation.userId
  const preferredName = isUserSide
    ? conversation.partnerDisplayName?.trim()
    : conversation.userDisplayName?.trim()
  return preferredName || defaultTitle || 'Conversation'
}

function resolveConversationPeerId(conversation: MessageConversationItem, currentUserId: string) {
  const current = currentUserId.trim()
  return current && conversation.userId === current
    ? (conversation.partnerId || '').trim()
    : (conversation.userId || '').trim()
}

function resolveAvatar(
  userId: string | undefined,
  avatarsByUserId: Record<string, string>,
  fallbackAvatar?: string,
) {
  const normalizedUserId = userId?.trim() || ''
  const fromMap = normalizedUserId ? avatarsByUserId[normalizedUserId]?.trim() || '' : ''
  const normalizedFallback = fallbackAvatar?.trim() || ''
  return fromMap || normalizedFallback || defaultAvatar
}

const MessageCenter = forwardRef<HTMLDivElement, MessageCenterProps>(function MessageCenter(
  {
    compact = false,
    isOpen,
    isThreadOpen,
    error = '',
    unreadCount,
    conversations,
    activeConversationId,
    messages,
    currentUserId,
    currentUserAvatar = '',
    avatarByUserId = {},
    draft,
    sending,
    loadingConversations,
    loadingMessages,
    onToggle,
    onSelectConversation,
    onCloseThread,
    onDraftChange,
    onSend,
  },
  ref,
) {
  const activeConversation = conversations.find(
    (conversation) => conversation.conversationId === activeConversationId,
  )

  const threadRows: Array<
    | { kind: 'date'; key: string; label: string }
    | { kind: 'message'; message: MessageEntryItem }
  > = []

  let previousBucket = ''
  messages.forEach((message, index) => {
    const bucket = toDateBucket(message.createdAt)
    if (bucket && bucket !== previousBucket) {
      threadRows.push({
        kind: 'date',
        key: `${bucket}-${index}`,
        label: formatDateDivider(message.createdAt),
      })
      previousBucket = bucket
    }
    threadRows.push({ kind: 'message', message })
  })

  return (
    <div className={`role-message-center ${compact ? 'role-message-center-compact' : ''}`} ref={ref}>
      <button
        type="button"
        className={`role-message-trigger ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label="Open message center"
      >
        <span className="role-message-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16h-6.3l-3.7 3a1 1 0 0 1-1.6-.78V16.2A2.5 2.5 0 0 1 4 13.8v-8.3Z" />
          </svg>
        </span>
        {unreadCount > 0 && (
          <span className="role-message-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="role-message-dropdown">
          <div className="role-message-header">
            <strong>Messages</strong>
            <span>{conversations.length}</span>
          </div>
          {error && <p className="role-message-error">{error}</p>}

          <aside className="role-message-conversations role-message-conversations-list-only">
            {loadingConversations ? (
              <p className="role-message-empty">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="role-message-empty">No conversation yet.</p>
            ) : (
              <ul>
                {conversations.map((conversation) => {
                  const title = resolveConversationTitle(conversation, currentUserId)
                  const peerId = resolveConversationPeerId(conversation, currentUserId)
                  const peerAvatar = resolveAvatar(peerId, avatarByUserId)
                  const unread = Math.max(0, Number(conversation.unreadCount) || 0)
                  return (
                    <li key={conversation.conversationId}>
                      <button
                        type="button"
                        className={`role-message-conversation-item ${
                          conversation.conversationId === activeConversationId ? 'active' : ''
                        }`}
                        onClick={() => onSelectConversation(conversation.conversationId)}
                      >
                        <div className="role-message-conversation-main">
                          <img
                            src={peerAvatar}
                            alt={title}
                            className="role-message-conversation-avatar"
                          />
                          <div className="role-message-conversation-content">
                            <div className="role-message-conversation-top">
                              <strong>{title}</strong>
                              <time>{formatOccurredAt(conversation.lastMessageAt)}</time>
                            </div>
                            <p>{conversation.lastMessagePreview || 'Start conversation...'}</p>
                          </div>
                        </div>
                        {unread > 0 && <span className="role-message-conversation-unread">{unread}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      )}

      {isThreadOpen && activeConversation && (
        <section className="role-message-thread-widget">
          <div className="role-message-thread-header">
            <img
              src={resolveAvatar(resolveConversationPeerId(activeConversation, currentUserId), avatarByUserId)}
              alt={resolveConversationTitle(activeConversation, currentUserId)}
              className="role-message-thread-avatar"
            />
            <div className="role-message-thread-header-info">
              <div className="role-message-thread-title-row">
                <strong>{resolveConversationTitle(activeConversation, currentUserId)}</strong>
                <span className="role-message-online-dot" aria-hidden="true" />
              </div>
              <span>Direct message</span>
            </div>
            <button
              type="button"
              className="role-message-thread-close"
              onClick={onCloseThread}
              aria-label="Close chat box"
            >
              &times;
            </button>
          </div>
          <div className="role-message-thread-body">
            {loadingMessages ? (
              <p className="role-message-empty">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="role-message-empty">No messages yet.</p>
            ) : (
              <ul>
                {threadRows.map((row) => {
                  if (row.kind === 'date') {
                    return (
                      <li key={row.key} className="role-message-date-divider">
                        <span>{row.label}</span>
                      </li>
                    )
                  }

                  const { message } = row
                  const mine = message.senderId === currentUserId
                  const senderAvatar = mine
                    ? resolveAvatar(currentUserId, avatarByUserId, currentUserAvatar)
                    : resolveAvatar(message.senderId, avatarByUserId)

                  return (
                    <li key={message.messageId} className={mine ? 'mine' : 'theirs'}>
                      {!mine && (
                        <img
                          src={senderAvatar}
                          alt={message.senderName?.trim() || 'User'}
                          className="role-message-item-avatar"
                        />
                      )}
                      <div className="role-message-bubble">
                        {!mine && (
                          <span className="role-message-sender">
                            {message.senderName?.trim() || message.senderRole || 'User'}
                          </span>
                        )}
                        <p>{message.content}</p>
                        <div className="role-message-bubble-meta">
                          <time>{formatOccurredAt(message.createdAt)}</time>
                          {mine && (
                            <span className="role-message-read-mark" aria-hidden="true">
                              <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M9.4 16.6 5.8 13l-1.4 1.4 5 5 10-10-1.4-1.4-8.6 8.6Zm5.4 0L13.4 15.2 12 16.6l2.8 2.8 7.8-7.8-1.4-1.4-6.4 6.4Z" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="role-message-compose">
            <div className="role-message-compose-row">
              <span className="role-message-compose-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M4 11.5a7.5 7.5 0 1 1 13.67 4.2l1.83 3.48-3.9-1.08A7.5 7.5 0 0 1 4 11.5Zm7.5-5.5a5.5 5.5 0 0 0-3.66 9.62l.4.35-.58 1.1 1.27-.35.36.17A5.5 5.5 0 1 0 11.5 6Z" />
                </svg>
              </span>
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!sending && draft.trim()) {
                      onSend()
                    }
                  }
                }}
                placeholder="Type your message..."
                rows={1}
              />
              <button
                type="button"
                className="role-message-emoji-btn"
                aria-label="Emoji picker"
                disabled
              >
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-3.2-8.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm6.4 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm-3.2 5.1c1.76 0 3.29-.95 4.12-2.35l-1.73-.96c-.48.82-1.37 1.3-2.39 1.3s-1.91-.48-2.39-1.3l-1.73.96A4.73 4.73 0 0 0 12 16.7Z" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="role-message-send-btn"
              onClick={onSend}
              disabled={sending || !draft.trim()}
              aria-label={sending ? 'Sending message' : 'Send message'}
            >
              {sending ? (
                <span className="role-message-send-loading" />
              ) : (
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M3.3 11.3 19.8 3.6c.96-.45 1.94.54 1.5 1.5l-7.74 16.47c-.4.86-1.66.83-2.03-.06l-2.17-5.28-5.29-2.17c-.88-.36-.91-1.61-.05-2.02Zm7.2 3.25 1.66 4.04 5.56-11.85-11.86 5.55 4.04 1.66 4.6-4.6 1.41 1.42-5.41 5.4Z" />
                </svg>
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  )
})

export default MessageCenter
