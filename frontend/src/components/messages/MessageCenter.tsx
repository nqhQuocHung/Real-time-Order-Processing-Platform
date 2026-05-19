import { forwardRef } from 'react'
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
  unreadCount: number
  conversations: MessageConversationItem[]
  activeConversationId: string
  messages: MessageEntryItem[]
  currentUserId: string
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

function resolveConversationTitle(conversation: MessageConversationItem, currentUserId: string) {
  const isUserSide = currentUserId === conversation.userId
  const defaultTitle = isUserSide ? conversation.partnerId : conversation.userId
  const preferredName = isUserSide
    ? conversation.partnerDisplayName?.trim()
    : conversation.userDisplayName?.trim()
  return preferredName || defaultTitle || 'Conversation'
}

const MessageCenter = forwardRef<HTMLDivElement, MessageCenterProps>(function MessageCenter(
  {
    compact = false,
    isOpen,
    isThreadOpen,
    unreadCount,
    conversations,
    activeConversationId,
    messages,
    currentUserId,
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

          <aside className="role-message-conversations role-message-conversations-list-only">
            {loadingConversations ? (
              <p className="role-message-empty">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="role-message-empty">No conversation yet.</p>
            ) : (
              <ul>
                {conversations.map((conversation) => {
                  const title = resolveConversationTitle(conversation, currentUserId)
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
                        <div className="role-message-conversation-top">
                          <strong>{title}</strong>
                          <time>{formatOccurredAt(conversation.lastMessageAt)}</time>
                        </div>
                        {conversation.productName && (
                          <span className="role-message-conversation-product">
                            {conversation.productName}
                          </span>
                        )}
                        <p>{conversation.lastMessagePreview || 'Start conversation...'}</p>
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
            <div className="role-message-thread-header-info">
              <strong>{resolveConversationTitle(activeConversation, currentUserId)}</strong>
              {activeConversation.productName && <span>{activeConversation.productName}</span>}
            </div>
            <button
              type="button"
              className="role-message-thread-close"
              onClick={onCloseThread}
              aria-label="Close chat box"
            >
              ×
            </button>
          </div>
          <div className="role-message-thread-body">
            {loadingMessages ? (
              <p className="role-message-empty">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="role-message-empty">No messages yet.</p>
            ) : (
              <ul>
                {messages.map((message) => {
                  const mine = message.senderId === currentUserId
                  return (
                    <li key={message.messageId} className={mine ? 'mine' : 'theirs'}>
                      <div className="role-message-bubble">
                        <span className="role-message-sender">
                          {mine ? 'You' : message.senderName?.trim() || message.senderRole || 'User'}
                        </span>
                        <p>{message.content}</p>
                        <time>{formatOccurredAt(message.createdAt)}</time>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="role-message-compose">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Type your message..."
              rows={3}
            />
            <button
              type="button"
              className="role-btn-primary"
              onClick={onSend}
              disabled={sending || !draft.trim()}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
})

export default MessageCenter
