import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { fetchMyProfile } from '../auth/authSession'
import {
  apis,
  clearAuthSession,
  endpoints,
  extractApiData,
  extractApiErrorMessage,
  getAuthSession,
} from '../config/apis'
import { AppRole, getRoleLabel } from '../constants/roles'
import { menuConfig } from '../config/menuConfig'
import { hasPermission, type PermissionKey } from '../config/permissionConfig'
import { resolveDefaultPathByRole } from '../config/roleConfig'
import defaultAvatar from '../assets/default-avatar.svg'
import NotificationBell, {
  type NotificationItem,
} from '../components/notifications/NotificationBell'
import MessageCenter, {
  type MessageConversationItem,
  type MessageEntryItem,
} from '../components/messages/MessageCenter'
import {
  APP_OPEN_MESSAGE_CONVERSATION_EVENT,
  type OpenMessageConversationDetail,
} from '../constants/messageEvents'
import useNotificationStream from '../hooks/useNotificationStream'
import './RoleLayout.css'

type ChangePasswordOtpResponse = {
  userId: string
  email?: string
  expiresAt?: string
  message?: string
}

type ChangePasswordResponse = {
  userId: string
  message?: string
}

type NavigationMenuItem = {
  id?: string
  key: string
  label: string
  path?: string
  permission?: string
  displayOrder?: number
  parentMenuId?: string | null
  parentMenuKey?: string | null
  isContainer?: boolean
  showOnMenu?: boolean
}

type NotificationPayload = Record<string, unknown>

type NotificationStreamEventDetail = {
  eventName: string
  payload: unknown
}

type MessageConversationListResponse = {
  content?: MessageConversationItem[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  last?: boolean
}

type MessageEntryListResponse = {
  content?: MessageEntryItem[]
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  last?: boolean
}

type MessageStreamPayload = {
  conversationId?: string
  message?: MessageEntryItem
}

const APP_NOTIFICATION_EVENT = 'app-notification-event'
const STREAM_EVENT_DEDUP_WINDOW_MS = 15000
const MESSAGE_PAGE_SIZE = 30

function toNotificationPayload(payload: unknown): NotificationPayload {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  return payload as NotificationPayload
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function truncateText(value: string, maxLength = 220) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}...`
}

function buildNotificationLink(
  eventName: string,
  requestId: string,
  payload: NotificationPayload,
) {
  const navigatePath =
    typeof payload.navigatePath === 'string'
      ? payload.navigatePath.trim()
      : ''
  if (navigatePath.startsWith('/')) {
    return navigatePath
  }

  if (eventName === 'partner.request.created' && requestId) {
    const encodedRequestId = encodeURIComponent(requestId)
    return `/admin/administration?focusPartnerRequest=${encodedRequestId}`
  }

  if (eventName === 'partner.request.decided' && requestId) {
    const encodedRequestId = encodeURIComponent(requestId)
    return `/user/dashboard?focusPartnerRequest=${encodedRequestId}`
  }

  if (
    eventName === 'payment.transaction.succeeded' ||
    eventName === 'payment.transaction.failed' ||
    eventName === 'order.lifecycle.paid' ||
    eventName === 'order.lifecycle.completed' ||
    eventName === 'order.lifecycle.failed'
  ) {
    return '/user/orders'
  }

  if (
    eventName === 'product.review.created' ||
    eventName === 'product.review.updated' ||
    eventName === 'product.review.comment.created'
  ) {
    return '/user/products'
  }

  return ''
}

function buildStreamEventDedupKey(eventName: string, payload: unknown): string {
  if (eventName === 'connected') {
    return ''
  }

  const data = toNotificationPayload(payload)
  const eventId = normalizeText(data.eventId)
  const requestId = normalizeText(data.requestId)
  const orderCode = normalizeText(data.orderCode)
  const providerTransactionId = normalizeText(data.providerTransactionId)
  const status = normalizeText(data.status)

  if (eventId) {
    return `${eventName}|eventId:${eventId}`
  }

  if (requestId) {
    return `${eventName}|requestId:${requestId}`
  }

  if (orderCode && providerTransactionId) {
    return `${eventName}|order:${orderCode}|txn:${providerTransactionId}|status:${status}`
  }

  if (orderCode) {
    return `${eventName}|order:${orderCode}|status:${status}`
  }

  const payloadSignature = truncateText(
    typeof payload === 'string' ? payload : JSON.stringify(data),
    280,
  )
  return `${eventName}|payload:${payloadSignature}`
}

function buildNotificationMessage(eventName: string, payload: unknown): NotificationItem | null {
  if (eventName === 'connected') {
    return null
  }

  // `order.lifecycle.paid` is kept for realtime refresh, but UI notification
  // is suppressed to avoid duplicate message with `payment.transaction.succeeded`.
  if (eventName === 'order.lifecycle.paid') {
    return null
  }

  const data = toNotificationPayload(payload)
  const eventId = normalizeText(data.eventId)
  const requestId = normalizeText(data.requestId)
  const username = normalizeText(data.username)
  const email = normalizeText(data.email)
  const requestNote = normalizeText(data.requestNote)
  const reviewNote = normalizeText(data.reviewNote)
  const decision = normalizeText(data.decision).toUpperCase()
  const orderCode = normalizeText(data.orderCode)
  const amount = normalizeText(data.amount)
  const currency = normalizeText(data.currency) || 'VND'
  const paymentStatus = normalizeText(data.status)
  const productId = normalizeText(data.productId)
  const actorUserName = normalizeText(data.actorUserName)
  const reviewPayload = toNotificationPayload(data.review)
  const commentPayload = toNotificationPayload(data.comment)
  const fallbackMessage =
    typeof payload === 'string'
      ? payload
      : JSON.stringify(data)

  let title = 'New notification'
  let message = truncateText(fallbackMessage || 'You have a new notification from the system.')

  if (eventName === 'partner.request.created') {
    const actor = username || email || 'user'
    title = 'New partner request'
    message = `New partner request from ${actor}.${requestNote ? ` Note: ${requestNote}` : ''}`
  }

  if (eventName === 'partner.request.decided') {
    const actor = username || email || 'user'
    const decisionLabel = decision.includes('REJECT')
      ? 'rejected'
      : decision.includes('APPROV')
        ? 'approved'
        : decision.toLowerCase() || 'updated'

    title = 'Partner request decision'
    message = `Partner request of ${actor} was ${decisionLabel}.${reviewNote ? ` Note: ${reviewNote}` : ''}`
  }

  if (eventName === 'payment.transaction.succeeded') {
    title = 'Payment successful'
    message = `Order ${orderCode || '-'} was paid successfully.${amount ? ` Amount: ${amount} ${currency}.` : ''}`
  }

  if (eventName === 'payment.transaction.failed') {
    title = 'Payment failed'
    message = `Order ${orderCode || '-'} payment failed.${paymentStatus ? ` Status: ${paymentStatus}.` : ''}`
  }

  if (eventName === 'order.lifecycle.completed') {
    title = 'Order completed'
    message = `Order ${orderCode || '-'} is completed.`
  }

  if (eventName === 'order.lifecycle.failed') {
    title = 'Order failed'
    message = `Order ${orderCode || '-'} processing failed.`
  }

  if (eventName === 'product.review.created') {
    const rating = String(reviewPayload.rating ?? '').trim()
    const actor = actorUserName || normalizeText(reviewPayload.userName) || 'A user'
    title = 'New product review'
    message = `${actor} posted a new review${productId ? ` for product ${productId}` : ''}.${rating ? ` Rating: ${rating}/5.` : ''}`
  }

  if (eventName === 'product.review.updated') {
    const actor = actorUserName || normalizeText(reviewPayload.userName) || 'A user'
    title = 'Product review updated'
    message = `${actor} updated a review${productId ? ` for product ${productId}` : ''}.`
  }

  if (eventName === 'product.review.comment.created') {
    const actor = actorUserName || normalizeText(commentPayload.userName) || 'A user'
    const shortComment = truncateText(normalizeText(commentPayload.content), 90)
    title = 'New review comment'
    message = `${actor} added a comment${productId ? ` for product ${productId}` : ''}.${shortComment ? ` "${shortComment}"` : ''}`
  }

  const occurredAt =
    normalizeText(data.occurredAt) ||
    normalizeText(data.reviewedAt) ||
    new Date().toISOString()

  const notificationId = eventId || requestId || `${eventName}-${Date.now()}-${Math.random()}`
  const link = buildNotificationLink(eventName, requestId, data)

  return {
    id: notificationId,
    title,
    message,
    eventType: eventName,
    occurredAt,
    link,
  }
}

function isDeprecatedAdminMenuItem(item: NavigationMenuItem): boolean {
  const path = (item.path || '').toLowerCase()
  return path === '/admin/users' || path === '/admin/partners'
}

type MenuTreeNode = NavigationMenuItem & {
  children: MenuTreeNode[]
}

function compareMenuOrder(first: Pick<NavigationMenuItem, 'displayOrder' | 'key'>, second: Pick<NavigationMenuItem, 'displayOrder' | 'key'>) {
  const firstOrder = typeof first.displayOrder === 'number' ? first.displayOrder : 100
  const secondOrder = typeof second.displayOrder === 'number' ? second.displayOrder : 100
  if (firstOrder !== secondOrder) {
    return firstOrder - secondOrder
  }
  return first.key.localeCompare(second.key)
}

function buildMenuTree(menuItems: NavigationMenuItem[]): MenuTreeNode[] {
  const sortedItems = [...menuItems].sort(compareMenuOrder)
  const nodeMap = new Map<string, MenuTreeNode>()
  sortedItems.forEach((item) => {
    nodeMap.set(item.key, { ...item, children: [] })
  })

  const rootNodes: MenuTreeNode[] = []
  nodeMap.forEach((node) => {
    const parentKey = (node.parentMenuKey || '').trim()
    const parentNode = parentKey ? nodeMap.get(parentKey) : null

    if (parentNode) {
      parentNode.children.push(node)
      return
    }
    rootNodes.push(node)
  })

  function sortNodes(nodes: MenuTreeNode[]) {
    nodes.sort(compareMenuOrder)
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(rootNodes)
  return rootNodes
}

function nodeHasPath(node: NavigationMenuItem) {
  return Boolean(node.path && node.path.trim())
}

function findActiveMenuKeyChain(nodes: MenuTreeNode[], pathname: string): string[] {
  for (const node of nodes) {
    const childChain = findActiveMenuKeyChain(node.children, pathname)
    if (childChain.length > 0) {
      return [node.key, ...childChain]
    }

    if (node.path === pathname) {
      return [node.key]
    }
  }

  return []
}

function nodeContainsPath(node: MenuTreeNode, pathname: string): boolean {
  if (node.path === pathname) {
    return true
  }
  return node.children.some((child) => nodeContainsPath(child, pathname))
}

function isContainerNode(node: NavigationMenuItem) {
  return Boolean(node.isContainer) || !nodeHasPath(node)
}

function isUserScopedPath(path?: string) {
  return Boolean(path && path.startsWith('/user/'))
}

function normalizePath(path?: string) {
  return (path || '').trim()
}

function withStaticGrouping(menuItems: NavigationMenuItem[], currentRole: AppRole): NavigationMenuItem[] {
  const hasExplicitParent = menuItems.some((item) => (item.parentMenuKey || '').trim())
  if (hasExplicitParent) {
    return menuItems
  }

  const groupPrefix = currentRole === AppRole.ADMIN
    ? '/admin/'
    : currentRole === AppRole.SHOPEE_PARTNER
      ? '/partner/'
      : ''

  if (!groupPrefix) {
    return menuItems
  }

  const groupKey = currentRole === AppRole.ADMIN ? 'admin-group' : 'partner-group'
  const groupLabel = currentRole === AppRole.ADMIN ? 'Admin' : 'Partner Management'

  const hasGroupChildren = menuItems.some((item) => normalizePath(item.path).startsWith(groupPrefix))
  if (!hasGroupChildren) {
    return menuItems
  }

  const groupNode: NavigationMenuItem = {
    key: groupKey,
    label: groupLabel,
    path: '',
    isContainer: true,
    displayOrder: 999,
  }

  const groupedMenus = menuItems.map((item) => {
    if (!normalizePath(item.path).startsWith(groupPrefix)) {
      return item
    }
    return {
      ...item,
      parentMenuKey: groupKey,
    }
  })

  return [groupNode, ...groupedMenus]
}

function isCurrentPathActive(path?: string, pathname?: string) {
  if (!path || !pathname) {
    return false
  }
  return path === pathname
}

function isMenuVisibleForRole(item: NavigationMenuItem, currentRole: AppRole) {
  if (item.showOnMenu === false) {
    return false
  }

  const key = item.key.toLowerCase()
  if (key.includes('profile')) {
    return false
  }

  const path = normalizePath(item.path)
  if (path.includes('/profile')) {
    return false
  }

  if (currentRole === AppRole.ADMIN && isDeprecatedAdminMenuItem(item)) {
    return false
  }

  return true
}

function RoleLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getAuthSession()
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const notificationMenuRef = useRef<HTMLDivElement | null>(null)
  const messageMenuRef = useRef<HTMLDivElement | null>(null)
  const streamEventSeenRef = useRef<Map<string, number>>(new Map())

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isMessageOpen, setIsMessageOpen] = useState(false)
  const [isMessageThreadOpen, setIsMessageThreadOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [openMenuGroups, setOpenMenuGroups] = useState<Record<string, boolean>>({})
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [messageConversations, setMessageConversations] = useState<MessageConversationItem[]>([])
  const [activeMessageConversationId, setActiveMessageConversationId] = useState('')
  const [conversationMessagesById, setConversationMessagesById] = useState<
    Record<string, MessageEntryItem[]>
  >({})
  const [messageDraft, setMessageDraft] = useState('')
  const [loadingMessageConversations, setLoadingMessageConversations] = useState(false)
  const [loadingMessageEntries, setLoadingMessageEntries] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)

  const [avatarUrl, setAvatarUrl] = useState('')
  const [useFallbackAvatar, setUseFallbackAvatar] = useState(false)

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState('')
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('')

  const currentRole = session?.role || AppRole.USER
  const currentUserId = session?.userId?.trim() || ''
  const isMessagingEnabled =
    currentRole === AppRole.USER || currentRole === AppRole.SHOPEE_PARTNER
  const dashboardPath = resolveDefaultPathByRole(currentRole, session?.backendMenus || [])

  const dynamicMenu: NavigationMenuItem[] = (session?.backendMenus || [])
    .filter((item) => item.key && item.label)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((item) => ({
      id: item.id,
      key: item.key,
      label: item.label,
      path: item.path,
      permission: item.permission || '',
      displayOrder: item.displayOrder,
      parentMenuId: item.parentMenuId || null,
      parentMenuKey: item.parentMenuKey || null,
      isContainer: item.isContainer,
      showOnMenu: item.showOnMenu !== false,
    }))

  const roleMenuSource: NavigationMenuItem[] = useMemo(() => {
    const staticMenu = (menuConfig[currentRole] as NavigationMenuItem[]).map((item) => ({
      ...item,
      displayOrder: item.displayOrder || 100,
    }))
    const baseMenu = dynamicMenu.length ? dynamicMenu : staticMenu

    if (currentRole !== AppRole.ADMIN) {
      return withStaticGrouping(baseMenu, currentRole)
    }

    if (dynamicMenu.length) {
      return withStaticGrouping(baseMenu, currentRole)
    }

    const mergedByKey = new Map<string, NavigationMenuItem>()
    ;[...baseMenu, ...(menuConfig[AppRole.USER] as NavigationMenuItem[])].forEach((item) => {
      if (!mergedByKey.has(item.key)) {
        mergedByKey.set(item.key, {
          ...item,
          displayOrder: item.displayOrder || 100,
        })
      }
    })

    return withStaticGrouping(Array.from(mergedByKey.values()), currentRole)
  }, [currentRole, dynamicMenu])

  const currentMenu: NavigationMenuItem[] = useMemo(() => {
    return roleMenuSource
      .filter((item) => {
        if (isContainerNode(item)) {
          return true
        }

        const allowedByPermission =
          !item.permission ||
          hasPermission(currentRole, item.permission as PermissionKey) ||
          (currentRole === AppRole.ADMIN && isUserScopedPath(item.path))

        return allowedByPermission
      })
      .filter((item) => isMenuVisibleForRole(item, currentRole))
  }, [roleMenuSource, currentRole])

  const menuTree = useMemo(() => buildMenuTree(currentMenu), [currentMenu])

  const activeMenuKeyChain = useMemo(
    () => findActiveMenuKeyChain(menuTree, location.pathname),
    [menuTree, location.pathname],
  )
  const activeMenuChainKey = activeMenuKeyChain.join('::')

  const editProfilePath = useMemo(() => {
    if (currentRole === AppRole.SHOPEE_PARTNER) {
      return '/partner/profile'
    }

    return '/user/profile'
  }, [currentRole])

  const currentPageLabel = useMemo(() => {
    const matchedMenu = roleMenuSource.find((item) => item.path === location.pathname)
    if (matchedMenu) {
      return matchedMenu.label
    }

    if (location.pathname.startsWith('/partner/profile')) {
      return 'Partner Profile'
    }

    if (location.pathname.startsWith('/user/profile')) {
      return 'Profile'
    }

    return 'Dashboard'
  }, [roleMenuSource, location.pathname])

  const activeConversationMessages = useMemo(
    () =>
      activeMessageConversationId
        ? (conversationMessagesById[activeMessageConversationId] || [])
        : [],
    [activeMessageConversationId, conversationMessagesById],
  )

  function sortConversations(items: MessageConversationItem[]) {
    return [...items].sort((first, second) => {
      const firstDate = first.lastMessageAt ? new Date(first.lastMessageAt).getTime() : 0
      const secondDate = second.lastMessageAt ? new Date(second.lastMessageAt).getTime() : 0
      return secondDate - firstDate
    })
  }

  function upsertConversationItem(
    previous: MessageConversationItem[],
    nextConversation: MessageConversationItem,
  ) {
    const nextId = nextConversation.conversationId
    if (!nextId) {
      return previous
    }

    const nextList = [...previous]
    const currentIndex = nextList.findIndex(
      (conversation) => conversation.conversationId === nextId,
    )

    if (currentIndex >= 0) {
      nextList[currentIndex] = {
        ...nextList[currentIndex],
        ...nextConversation,
      }
    } else {
      nextList.push(nextConversation)
    }

    return sortConversations(nextList)
  }

  async function loadMessageConversations(preferredConversationId?: string) {
    if (!isMessagingEnabled) {
      return
    }

    try {
      setLoadingMessageConversations(true)
      const response = await apis().get(endpoints.messages.conversations, {
        params: {
          page: 0,
          size: 50,
        },
      })
      const data = extractApiData<MessageConversationListResponse>(response)
      const content = Array.isArray(data.content) ? data.content : []
      setMessageConversations(sortConversations(content))

      const targetConversationId =
        preferredConversationId?.trim() ||
        activeMessageConversationId ||
        ''
      if (targetConversationId) {
        const exists = content.some(
          (conversation) => conversation.conversationId === targetConversationId,
        )
        setActiveMessageConversationId(exists ? targetConversationId : '')
      }
    } catch (error) {
      console.error('Cannot load message conversations:', error)
    } finally {
      setLoadingMessageConversations(false)
    }
  }

  async function markMessageConversationAsRead(conversationId: string) {
    const normalizedConversationId = conversationId.trim()
    if (!normalizedConversationId) {
      return
    }

    setMessageConversations((previous) =>
      previous.map((conversation) =>
        conversation.conversationId === normalizedConversationId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation,
      ),
    )

    try {
      await apis().patch(
        endpoints.messages.markConversationRead(normalizedConversationId),
        {},
      )
    } catch (error) {
      console.error('Cannot mark conversation as read:', error)
    }
  }

  async function loadMessageEntries(
    conversationId: string,
    options?: { markAsRead?: boolean },
  ) {
    const normalizedConversationId = conversationId.trim()
    if (!normalizedConversationId || !isMessagingEnabled) {
      return
    }

    const shouldMarkAsRead = options?.markAsRead !== false
    try {
      setLoadingMessageEntries(true)
      const response = await apis().get(
        endpoints.messages.conversationMessages(normalizedConversationId),
        {
          params: {
            page: 0,
            size: MESSAGE_PAGE_SIZE,
            markAsRead: shouldMarkAsRead,
          },
        },
      )
      const data = extractApiData<MessageEntryListResponse>(response)
      const content = Array.isArray(data.content) ? data.content : []
      setConversationMessagesById((previous) => ({
        ...previous,
        [normalizedConversationId]: content,
      }))

      if (shouldMarkAsRead) {
        setMessageConversations((previous) =>
          previous.map((conversation) =>
            conversation.conversationId === normalizedConversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                }
              : conversation,
          ),
        )
      }
    } catch (error) {
      console.error('Cannot load conversation messages:', error)
    } finally {
      setLoadingMessageEntries(false)
    }
  }

  async function openMessageThread(
    conversationId: string,
    options?: { closeList?: boolean },
  ) {
    const normalizedConversationId = conversationId.trim()
    if (!normalizedConversationId) {
      return
    }

    setActiveMessageConversationId(normalizedConversationId)
    setIsMessageThreadOpen(true)
    setMessageDraft('')
    if (options?.closeList !== false) {
      setIsMessageOpen(false)
    }
    await loadMessageEntries(normalizedConversationId, { markAsRead: true })
  }

  async function openMessageConversationFromProduct(
    detail: OpenMessageConversationDetail,
  ) {
    if (!isMessagingEnabled) {
      return
    }

    const partnerUserId = detail.partnerUserId?.trim() || ''
    if (!partnerUserId) {
      return
    }

    try {
      const response = await apis().post(endpoints.messages.openConversation, {
        partnerUserId,
        partnerDisplayName: detail.partnerDisplayName?.trim() || null,
        productId: detail.productId?.trim() || null,
        productName: detail.productName?.trim() || null,
      })
      const conversation = extractApiData<MessageConversationItem>(response)
      const conversationId = conversation.conversationId?.trim() || ''
      if (!conversationId) {
        return
      }

      setIsNotificationOpen(false)
      setIsUserMenuOpen(false)
      setIsMessageOpen(false)
      setMessageConversations((previous) =>
        upsertConversationItem(previous, {
          ...conversation,
          unreadCount: 0,
        }),
      )
      await openMessageThread(conversationId)
      await loadMessageConversations(conversationId)
    } catch (error) {
      console.error('Cannot open message conversation:', error)
    }
  }

  async function handleSendMessage() {
    if (!isMessagingEnabled) {
      return
    }

    const conversationId = activeMessageConversationId.trim()
    const content = messageDraft.trim()
    if (!conversationId || !content || sendingMessage) {
      return
    }

    try {
      setSendingMessage(true)
      const response = await apis().post(
        endpoints.messages.conversationMessages(conversationId),
        { content },
      )
      const message = extractApiData<MessageEntryItem>(response)
      setMessageDraft('')
      setConversationMessagesById((previous) => {
        const existing = previous[conversationId] || []
        if (existing.some((item) => item.messageId === message.messageId)) {
          return previous
        }
        return {
          ...previous,
          [conversationId]: [...existing, message],
        }
      })

      setMessageConversations((previous) => {
        const existing = previous.find(
          (conversation) => conversation.conversationId === conversationId,
        )
        const nextConversation: MessageConversationItem = {
          conversationId,
          userId: existing?.userId || '',
          userDisplayName: existing?.userDisplayName,
          partnerId: existing?.partnerId || '',
          partnerDisplayName: existing?.partnerDisplayName,
          productId: existing?.productId,
          productName: existing?.productName,
          lastMessagePreview: message.content,
          lastMessageSenderId: message.senderId,
          lastMessageSenderName: message.senderName,
          lastMessageAt: message.createdAt || new Date().toISOString(),
          unreadCount: existing?.unreadCount || 0,
        }
        return upsertConversationItem(previous, nextConversation)
      })
    } catch (error) {
      console.error('Cannot send message:', error)
    } finally {
      setSendingMessage(false)
    }
  }

  function handleIncomingMessageStream(payload: unknown) {
    const parsedPayload = toNotificationPayload(payload) as MessageStreamPayload &
      Record<string, unknown>
    const conversationId = normalizeText(parsedPayload.conversationId)
    const rawMessage = parsedPayload.message
    const incomingMessage =
      rawMessage && typeof rawMessage === 'object'
        ? (rawMessage as MessageEntryItem)
        : null

    if (!conversationId) {
      return
    }

    if (incomingMessage?.messageId) {
      setConversationMessagesById((previous) => {
        const existing = previous[conversationId] || []
        if (existing.some((item) => item.messageId === incomingMessage.messageId)) {
          return previous
        }

        return {
          ...previous,
          [conversationId]: [...existing, incomingMessage],
        }
      })
    }

    const unreadIncrement =
      incomingMessage &&
      incomingMessage.senderId &&
      incomingMessage.senderId !== currentUserId &&
      incomingMessage.recipientId === currentUserId &&
      (!isMessageThreadOpen || activeMessageConversationId !== conversationId)
        ? 1
        : 0

    setMessageConversations((previous) => {
      const fallbackConversation: MessageConversationItem = {
        conversationId,
        userId: normalizeText(parsedPayload.userId),
        userDisplayName: normalizeText(parsedPayload.userDisplayName),
        partnerId: normalizeText(parsedPayload.partnerId),
        partnerDisplayName: normalizeText(parsedPayload.partnerDisplayName),
        productId: normalizeText(parsedPayload.productId),
        productName: normalizeText(parsedPayload.productName),
        lastMessagePreview: incomingMessage?.content || '',
        lastMessageSenderId: incomingMessage?.senderId,
        lastMessageSenderName: incomingMessage?.senderName,
        lastMessageAt:
          incomingMessage?.createdAt ||
          normalizeText(parsedPayload.lastMessageAt) ||
          new Date().toISOString(),
        unreadCount: unreadIncrement,
      }

      const existingConversation = previous.find(
        (conversation) => conversation.conversationId === conversationId,
      )
      const mergedConversation = {
        ...(existingConversation || fallbackConversation),
        ...fallbackConversation,
        unreadCount: Math.max(
          0,
          (existingConversation?.unreadCount || 0) + unreadIncrement,
        ),
      }

      if (isMessageThreadOpen && activeMessageConversationId === conversationId) {
        mergedConversation.unreadCount = 0
      }

      return upsertConversationItem(previous, mergedConversation)
    })

    if (isMessageThreadOpen && activeMessageConversationId === conversationId) {
      void markMessageConversationAsRead(conversationId)
    }
  }

  useNotificationStream({
    enabled: Boolean(session?.accessToken),
    onEvent: (eventName, payload) => {
      const dedupKey = buildStreamEventDedupKey(eventName, payload)
      if (dedupKey) {
        const now = Date.now()
        const seenMap = streamEventSeenRef.current

        seenMap.forEach((seenAt, key) => {
          if (now - seenAt > STREAM_EVENT_DEDUP_WINDOW_MS) {
            seenMap.delete(key)
          }
        })

        const lastSeenAt = seenMap.get(dedupKey)
        if (typeof lastSeenAt === 'number' && now - lastSeenAt <= STREAM_EVENT_DEDUP_WINDOW_MS) {
          return
        }

        seenMap.set(dedupKey, now)
      }

      window.dispatchEvent(
        new CustomEvent<NotificationStreamEventDetail>(APP_NOTIFICATION_EVENT, {
          detail: {
            eventName,
            payload,
          },
        }),
      )

      if (eventName === 'chat.message.created') {
        handleIncomingMessageStream(payload)
        return
      }

      const notification = buildNotificationMessage(eventName, payload)
      if (!notification) {
        return
      }

      setNotifications((prev) => [notification, ...prev].slice(0, 30))
      if (!isNotificationOpen) {
        setUnreadNotificationCount((prev) => prev + 1)
      }

    },
    onError: (streamError) => {
      console.error('Notification stream error:', streamError)
    },
  })

  useEffect(() => {
    let active = true

    async function loadAvatar() {
      try {
        const profile = await fetchMyProfile()
        if (!active) {
          return
        }

        setAvatarUrl(profile.avatar?.trim() || '')
        setUseFallbackAvatar(false)
      } catch {
        if (active) {
          setAvatarUrl('')
        }
      }
    }

    void loadAvatar()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ avatar?: string }>
      const nextAvatar = customEvent.detail?.avatar?.trim() || ''
      setAvatarUrl(nextAvatar)
      setUseFallbackAvatar(false)
    }

    window.addEventListener('auth-profile-updated', handleProfileUpdated as EventListener)

    return () => {
      window.removeEventListener('auth-profile-updated', handleProfileUpdated as EventListener)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)')

    const sync = (matches: boolean) => {
      setIsMobileViewport(matches)
      if (!matches) {
        setIsMobileMenuOpen(false)
      }
    }

    sync(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => {
      sync(event.matches)
    }

    mediaQuery.addEventListener('change', onChange)

    return () => {
      mediaQuery.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsUserMenuOpen(false)
    setIsNotificationOpen(false)
    setIsMessageOpen(false)
    setIsMessageThreadOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isNotificationOpen) {
      return
    }
    setUnreadNotificationCount(0)
  }, [isNotificationOpen])

  useEffect(() => {
    const unread = messageConversations.reduce(
      (sum, conversation) => sum + Math.max(0, Number(conversation.unreadCount) || 0),
      0,
    )
    setUnreadMessageCount(unread)
  }, [messageConversations])

  useEffect(() => {
    if (!isMessageOpen || !isMessagingEnabled) {
      return
    }
    void loadMessageConversations()
  }, [isMessageOpen, isMessagingEnabled])

  useEffect(() => {
    if (!isMessageThreadOpen || !isMessagingEnabled) {
      return
    }
    const conversationId = activeMessageConversationId.trim()
    if (!conversationId) {
      return
    }
    void loadMessageEntries(conversationId, { markAsRead: true })
  }, [activeMessageConversationId, isMessageThreadOpen, isMessagingEnabled])

  useEffect(() => {
    function handleOpenConversationEvent(event: Event) {
      if (!isMessagingEnabled) {
        return
      }
      const customEvent = event as CustomEvent<OpenMessageConversationDetail>
      const detail = customEvent.detail
      if (!detail?.partnerUserId) {
        return
      }
      void openMessageConversationFromProduct(detail)
    }

    window.addEventListener(
      APP_OPEN_MESSAGE_CONVERSATION_EVENT,
      handleOpenConversationEvent as EventListener,
    )

    return () => {
      window.removeEventListener(
        APP_OPEN_MESSAGE_CONVERSATION_EVENT,
        handleOpenConversationEvent as EventListener,
      )
    }
  }, [isMessagingEnabled])

  useEffect(() => {
    if (!activeMenuChainKey) {
      return
    }

    setOpenMenuGroups((prev) => {
      const next = { ...prev }
      let changed = false
      activeMenuChainKey.split('::').forEach((menuKey) => {
        if (!next[menuKey]) {
          next[menuKey] = true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [activeMenuChainKey])

  useEffect(() => {
    if (!isUserMenuOpen && !isNotificationOpen && !isMessageOpen) {
      return
    }

    function handleMouseDown(event: MouseEvent) {
      const targetNode = event.target as Node
      const clickedInsideUserMenu = Boolean(
        userMenuRef.current?.contains(targetNode),
      )
      const clickedInsideNotificationMenu = Boolean(
        notificationMenuRef.current?.contains(targetNode),
      )
      const clickedInsideMessageMenu = Boolean(
        messageMenuRef.current?.contains(targetNode),
      )

      if (
        clickedInsideUserMenu ||
        clickedInsideNotificationMenu ||
        clickedInsideMessageMenu
      ) {
        return
      }

      setIsUserMenuOpen(false)
      setIsNotificationOpen(false)
      setIsMessageOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
        setIsNotificationOpen(false)
        setIsMessageOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMessageOpen, isNotificationOpen, isUserMenuOpen])

  function resetChangePasswordForm() {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setOtp('')
    setOtpEmail('')
    setOtpStep(false)
    setChangePasswordError('')
    setChangePasswordSuccess('')
  }

  function closeChangePasswordModal() {
    if (changePasswordLoading) {
      return
    }

    setIsChangePasswordOpen(false)
    resetChangePasswordForm()
  }

  async function handleSendChangePasswordOtp() {
    setChangePasswordError('')
    setChangePasswordSuccess('')

    if (!session?.userId) {
      setChangePasswordError('User session not found. Please login again.')
      return
    }

    if (!oldPassword.trim()) {
      setChangePasswordError('Please enter your current password.')
      return
    }

    if (!newPassword.trim()) {
      setChangePasswordError('Please enter a new password.')
      return
    }

    if (newPassword.trim().length < 8) {
      setChangePasswordError('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError('Password confirmation does not match.')
      return
    }

    try {
      setChangePasswordLoading(true)

      const response = await apis().post(endpoints.auth.otpChangePassword, {
        userId: session.userId,
        oldPassword: oldPassword.trim(),
      })

      const data = extractApiData<ChangePasswordOtpResponse>(response)
      setOtpStep(true)
      setOtp('')
      setOtpEmail(data.email || session.email || '')
      setChangePasswordSuccess(
        data.message || 'OTP sent to your email. Please enter OTP to continue.',
      )
    } catch (err) {
      setChangePasswordError(
        extractApiErrorMessage(err, 'Cannot send OTP for password change.'),
      )
    } finally {
      setChangePasswordLoading(false)
    }
  }

  async function handleConfirmChangePassword() {
    setChangePasswordError('')
    setChangePasswordSuccess('')

    if (!session?.userId) {
      setChangePasswordError('User session not found. Please login again.')
      return
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setChangePasswordError('OTP must be exactly 6 digits.')
      return
    }

    try {
      setChangePasswordLoading(true)
      const response = await apis().post(endpoints.auth.changePassword, {
        userId: session.userId,
        otp: otp.trim(),
        newPassword: newPassword.trim(),
      })

      const data = extractApiData<ChangePasswordResponse>(response)
      setChangePasswordSuccess(data.message || 'Password updated successfully.')
      window.setTimeout(() => {
        setIsChangePasswordOpen(false)
        resetChangePasswordForm()
      }, 1200)
    } catch (err) {
      setChangePasswordError(
        extractApiErrorMessage(err, 'Password change failed. Please check OTP and try again.'),
      )
    } finally {
      setChangePasswordLoading(false)
    }
  }

  function handleEditProfile() {
    setIsUserMenuOpen(false)
    navigate(editProfilePath)
  }

  function openChangePasswordModal() {
    setIsUserMenuOpen(false)
    setIsChangePasswordOpen(true)
    resetChangePasswordForm()
  }

  function handleLogout() {
    clearAuthSession()
    navigate('/login', { replace: true })
  }

  function handleGoDashboard() {
    setIsUserMenuOpen(false)
    setIsNotificationOpen(false)
    setIsMessageOpen(false)
    setIsMessageThreadOpen(false)
    setIsMobileMenuOpen(false)
    navigate(dashboardPath)
  }

  const displayedAvatar = !useFallbackAvatar && avatarUrl ? avatarUrl : defaultAvatar

  function toggleMenuGroup(menuKey: string) {
    setOpenMenuGroups((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }))
  }

  function renderMenuNode(node: MenuTreeNode) {
    const hasChildren = node.children.length > 0
    const nodePath = normalizePath(node.path)
    const pathActive = isCurrentPathActive(nodePath, location.pathname)
    const nodeOrChildActive = hasChildren ? nodeContainsPath(node, location.pathname) : pathActive
    const isOpen = hasChildren ? (openMenuGroups[node.key] ?? nodeOrChildActive) : false

    if (!hasChildren && isContainerNode(node) && !nodeHasPath(node)) {
      return null
    }

    if (hasChildren || isContainerNode(node)) {
      return (
        <div key={node.key} className="role-menu-group">
          <button
            type="button"
            className={`role-menu-item role-menu-group-trigger ${nodeOrChildActive ? 'active' : ''}`}
            onClick={() => toggleMenuGroup(node.key)}
            aria-expanded={hasChildren ? isOpen : false}
          >
            <span>{node.label}</span>
            {hasChildren && (
              <span className={`role-menu-group-caret ${isOpen ? 'open' : ''}`}>
                v
              </span>
            )}
          </button>

          {hasChildren && isOpen && (
            <div className="role-submenu">
              {node.children.map((child) => renderMenuNode(child))}
            </div>
          )}
        </div>
      )
    }

    if (!nodeHasPath(node)) {
      return null
    }

    return (
      <NavLink
        key={node.key}
        to={nodePath}
        className={({ isActive }) => `role-menu-item ${isActive ? 'active' : ''}`}
      >
        {node.label}
      </NavLink>
    )
  }

  function renderUserMenu(compact = false) {
    const usernameLabel = session?.username || 'User'

    return (
      <div className={`role-user-controls ${compact ? 'role-user-controls-compact' : ''}`}>
        {isMessagingEnabled && (
          <MessageCenter
            ref={messageMenuRef}
            compact={compact}
            isOpen={isMessageOpen}
            isThreadOpen={isMessageThreadOpen}
            unreadCount={unreadMessageCount}
            conversations={messageConversations}
            activeConversationId={activeMessageConversationId}
            messages={activeConversationMessages}
            currentUserId={currentUserId}
            draft={messageDraft}
            sending={sendingMessage}
            loadingConversations={loadingMessageConversations}
            loadingMessages={loadingMessageEntries}
            onToggle={() => {
              setIsUserMenuOpen(false)
              setIsNotificationOpen(false)
              setIsMessageOpen((state) => !state)
            }}
            onSelectConversation={(conversationId) => {
              void openMessageThread(conversationId)
            }}
            onCloseThread={() => setIsMessageThreadOpen(false)}
            onDraftChange={setMessageDraft}
            onSend={() => {
              void handleSendMessage()
            }}
          />
        )}

        <NotificationBell
          ref={notificationMenuRef}
          compact={compact}
          isOpen={isNotificationOpen}
          notifications={notifications}
          onItemClick={(item) => {
            setIsNotificationOpen(false)
            setIsMessageOpen(false)
            if (!item.link) {
              return
            }
            navigate(item.link)
          }}
          unreadCount={unreadNotificationCount}
          onToggle={() => {
            setIsUserMenuOpen(false)
            setIsMessageOpen(false)
            setIsNotificationOpen((state) => !state)
          }}
        />

        <div
          className={`role-user-menu ${compact ? 'role-user-menu-compact' : ''}`}
          ref={userMenuRef}
        >
          <button
            type="button"
            className={`role-user-trigger ${compact ? 'compact' : ''}`}
            onClick={() => {
              setIsNotificationOpen(false)
              setIsMessageOpen(false)
              setIsUserMenuOpen((state) => !state)
            }}
            aria-expanded={isUserMenuOpen}
          >
            <img
              src={displayedAvatar}
              alt="User avatar"
              className="role-avatar"
              onError={() => setUseFallbackAvatar(true)}
            />
            {!compact && (
              <div className="role-user-meta">
                <strong>{session?.username || 'Unknown user'}</strong>
                <span>{session?.email || '-'}</span>
              </div>
            )}
            {compact ? (
              <span className="role-user-trigger-label">{usernameLabel}</span>
            ) : (
              <span className={`role-user-caret ${isUserMenuOpen ? 'open' : ''}`}>v</span>
            )}
          </button>

          {isUserMenuOpen && (
            <div className="role-user-dropdown" role="menu">
              <button
                type="button"
                className="role-user-dropdown-item"
                onClick={handleEditProfile}
              >
                Edit profile
              </button>
              <button
                type="button"
                className="role-user-dropdown-item"
                onClick={openChangePasswordModal}
              >
                Change password
              </button>
              <button
                type="button"
                className="role-user-dropdown-item danger"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="role-layout-shell">
      <aside className="role-sidebar">
        <div className="role-sidebar-top">
          <button
            type="button"
            className="role-brand role-brand-button"
            onClick={handleGoDashboard}
          >
            <span className="role-brand-badge">RT</span>
            <div>
              <h1>Order Platform</h1>
              <p>{getRoleLabel(currentRole)}</p>
            </div>
          </button>

          {isMobileViewport && renderUserMenu(true)}
        </div>

        <button
          type="button"
          className="role-mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((state) => !state)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="role-sidebar-menu"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <span aria-hidden="true" className="role-mobile-menu-icon">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav
          id="role-sidebar-menu"
          className={`role-menu ${isMobileMenuOpen ? 'is-open' : ''}`}
        >
          {menuTree.map((node) => renderMenuNode(node))}
        </nav>

      </aside>

      <main className="role-main">
        <header className="role-header">
          <div>
            <h2>{currentPageLabel}</h2>
            <p className="role-muted">Role: {getRoleLabel(currentRole)}</p>
          </div>
          {!isMobileViewport && <div className="role-header-actions">{renderUserMenu()}</div>}
        </header>

        <section className="role-content">
          <Outlet />
        </section>
      </main>

      {isChangePasswordOpen && (
        <div className="role-modal-backdrop" onClick={closeChangePasswordModal}>
          <div className="role-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Change password</h3>

            {changePasswordError && <p className="role-error">{changePasswordError}</p>}
            {changePasswordSuccess && <p className="role-muted">{changePasswordSuccess}</p>}

            {!otpStep && (
              <div className="role-modal-field-grid">
                <label className="role-modal-label" htmlFor="oldPasswordInput">
                  Current password
                  <input
                    id="oldPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="current-password"
                  />
                </label>

                <label className="role-modal-label" htmlFor="newPasswordInput">
                  New password
                  <input
                    id="newPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="new-password"
                  />
                </label>

                <label className="role-modal-label" htmlFor="confirmPasswordInput">
                  Confirm new password
                  <input
                    id="confirmPasswordInput"
                    className="role-modal-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={changePasswordLoading}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}

            {otpStep && (
              <div className="role-modal-field-grid">
                <p className="role-muted">OTP has been sent to {otpEmail || 'your email'}.</p>

                <label className="role-modal-label" htmlFor="otpInput">
                  OTP (6 digits)
                  <input
                    id="otpInput"
                    className="role-modal-input"
                    type="text"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    disabled={changePasswordLoading}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </label>
              </div>
            )}

            <div className="role-modal-actions">
              {!otpStep && (
                <button
                  type="button"
                  className="role-btn-primary"
                  onClick={handleSendChangePasswordOtp}
                  disabled={changePasswordLoading}
                >
                  {changePasswordLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              )}

              {otpStep && (
                <>
                  <button
                    type="button"
                    className="role-btn-ghost"
                    onClick={handleSendChangePasswordOtp}
                    disabled={changePasswordLoading}
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    className="role-btn-primary"
                    onClick={handleConfirmChangePassword}
                    disabled={changePasswordLoading}
                  >
                    {changePasswordLoading ? 'Updating...' : 'Confirm'}
                  </button>
                </>
              )}

              <button
                type="button"
                className="role-btn-ghost"
                onClick={closeChangePasswordModal}
                disabled={changePasswordLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoleLayout
