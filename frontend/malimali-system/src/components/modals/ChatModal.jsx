import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MdChat, MdClose, MdSend, MdCampaign,
  MdDoneAll, MdDone, MdSearch
} from 'react-icons/md'
import { useApp } from '@/context/AppContext'
import { useSocket } from '@/context/SocketContext'
import styles from '@/styles/ChatModal.module.css'

export default function ChatModal({ onClose }) {
  const {
    currentUser, isOwner, users,
    conversations, fetchConversations,
    messages, setMessages,
    fetchThread, sendMessage, sendBroadcast,
    setUnreadMsgCount, fetchUnreadMsgCount
  } = useApp()

  const socket = useSocket()

  const [activeContact,    setActiveContact]    = useState(null)
  const [broadcastMode,    setBroadcastMode]    = useState(false)
  const [broadcastHistory, setBroadcastHistory] = useState([])
  const [input,            setInput]            = useState('')
  const [broadcastInput,   setBroadcastInput]   = useState('')
  const [sending,          setSending]          = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [search,           setSearch]           = useState('')
  // ── Real owner ID fetched from backend — avoids "owner" string fallback ──
  const [ownerContact,     setOwnerContact]     = useState(null)

  const messagesEndRef   = useRef(null)
  const textareaRef      = useRef(null)
  const activeContactRef = useRef(activeContact)
  const broadcastModeRef = useRef(broadcastMode)

  useEffect(() => { activeContactRef.current = activeContact }, [activeContact])
  useEffect(() => { broadcastModeRef.current = broadcastMode }, [broadcastMode])

  const myId = String(currentUser?._id || currentUser?.id || '')

  // ── Fetch real owner ID for staff on mount ─────────────────────────
  // Without this, first-ever message uses 'owner' string as receiverId
  // which fails User.findById() on the backend → 404 → message not sent
  useEffect(() => {
    if (isOwner) return
    const token = currentUser?.token
    if (!token) return
    fetch('http://localhost:5000/api/messages/owner-id', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setOwnerContact({
            id:    String(data.ownerId),
            name:  data.ownerName,
            role:  'owner',
            store: ''
          })
        }
      })
      .catch(() => {})
  }, [isOwner, currentUser?.token])

  // ── Reset unread badge when modal opens ────────────────────────────
  useEffect(() => {
    setTimeout(() => setUnreadMsgCount(0), 0)
  }, [setUnreadMsgCount])

  // ── Auto scroll ────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, broadcastHistory])

  // ── Load thread when contact changes ──────────────────────────────
  useEffect(() => {
    if (!activeContact) return
    setTimeout(() => setLoading(true), 0)
    fetchThread(activeContact.id)
      .finally(() => setTimeout(() => setLoading(false), 0))
  }, [activeContact, fetchThread])

  // ── Load broadcast history ─────────────────────────────────────────
  useEffect(() => {
    if (!broadcastMode) return
    setTimeout(() => setLoading(true), 0)
    fetchThread('broadcast')
      .then(msgs => setTimeout(() => setBroadcastHistory(msgs || []), 0))
      .finally(() => setTimeout(() => setLoading(false), 0))
  }, [broadcastMode, fetchThread])

  // ── Socket: messages_read ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handleMessagesRead = () => {
      if (activeContactRef.current) fetchThread(activeContactRef.current.id)
      fetchUnreadMsgCount()
    }
    socket.on('messages_read', handleMessagesRead)
    return () => { socket.off('messages_read', handleMessagesRead) }
  }, [socket, fetchThread, fetchUnreadMsgCount])

  // ── Socket: live new message delivery ─────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (data) => {
      const msg = data?.message
      if (!msg) return

      if (msg.isBroadcast) {
        if (broadcastModeRef.current) {
          setTimeout(() => setBroadcastHistory(prev => {
            const exists = prev.some(m => String(m._id) === String(msg._id))
            if (exists) return prev
            return [...prev, msg]
          }), 0)
        }
        setTimeout(() => setUnreadMsgCount(0), 0)
        return
      }

      const current    = activeContactRef.current
      if (!current) return

      const senderId   = String(msg.senderId)
      const receiverId = String(msg.receiverId || '')
      const activeId   = String(current.id)

      const belongsToThread =
        (senderId === activeId && receiverId === myId) ||
        (senderId === myId     && receiverId === activeId)

      if (belongsToThread) {
        setTimeout(() => setMessages(prev => {
          const exists = prev.some(m => String(m._id) === String(msg._id))
          if (exists) return prev
          return [...prev, msg]
        }), 0)
        fetchThread(current.id)
        setTimeout(() => setUnreadMsgCount(0), 0)
      }
    }

    socket.on('new_message', handleNewMessage)
    return () => { socket.off('new_message', handleNewMessage) }
  }, [socket, myId, fetchThread, setMessages, setUnreadMsgCount])

  // ── Staff: auto open owner thread on first load ────────────────────
  // Use ownerContact (real _id from backend) if no conversation exists yet
  useEffect(() => {
    if (isOwner) return
    if (activeContact) return

    const ownerConv = conversations.find(c => !c.isBroadcast)
    if (ownerConv) {
      setTimeout(() => setActiveContact({
        id:    ownerConv.otherId,
        name:  ownerConv.otherName,
        role:  'owner',
        store: ''
      }), 0)
    } else if (ownerContact) {
      // No previous conversation — use the real owner ID fetched from backend
      setTimeout(() => setActiveContact(ownerContact), 0)
    }
  }, [conversations, isOwner, activeContact, ownerContact])

  // ── Build contacts list for owner ─────────────────────────────────
  const getOwnerContacts = () => {
    const staff = (users || []).filter(u => u.role !== 'owner')
    return staff.map(u => {
      const conv = conversations.find(c =>
        c.otherId === String(u._id) && !c.isBroadcast
      )
      return {
        id:          String(u._id),
        name:        u.fullname || u.username,
        role:        u.role,
        store:       u.store || '',
        lastMessage: conv?.lastMessage || '',
        lastTime:    conv?.lastMessageAt || null,
        unread:      conv?.unreadCount  || 0,
      }
    })
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.store.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread
      if (a.lastTime && b.lastTime) return new Date(b.lastTime) - new Date(a.lastTime)
      if (a.lastTime) return -1
      if (b.lastTime) return 1
      return a.name.localeCompare(b.name)
    })
  }

  // ── Send direct message ────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeContact || sending) return
    setSending(true)
    await sendMessage(activeContact.id, input.trim())
    setInput('')
    setSending(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [input, activeContact, sending, sendMessage])

  // ── Send broadcast ─────────────────────────────────────────────────
  const handleBroadcast = useCallback(async () => {
    if (!broadcastInput.trim() || sending) return
    setSending(true)
    const result = await sendBroadcast(broadcastInput.trim())
    if (result.success) {
      setBroadcastInput('')
      fetchConversations()
      fetchThread('broadcast').then(msgs =>
        setTimeout(() => setBroadcastHistory(msgs || []), 0)
      )
    }
    setSending(false)
  }, [broadcastInput, sending, sendBroadcast, fetchConversations, fetchThread])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (broadcastMode) handleBroadcast()
      else if (activeContact) handleSend()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const getInitials = (name = '') =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d    = new Date(dateStr)
    const now  = new Date()
    const diff = now - d
    if (diff < 60000)    return 'now'
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
  }

  const formatMsgTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr) => {
    const d         = new Date(dateStr)
    const today     = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString())     return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const isRead = (msg) => {
    if (!msg.readBy || msg.readBy.length === 0) return false
    return msg.readBy.some(r => String(r.userId) !== myId)
  }

  const getAvatarClass = (role) => {
    if (role === 'owner')   return styles.avatarOwner
    if (role === 'manager') return styles.avatarManager
    return styles.avatarCashier
  }

  // ── Group messages by date ─────────────────────────────────────────
  const groupMessages = (msgList) => {
    const groups = []
    let lastDate = null
    for (const msg of msgList) {
      const dateStr = new Date(msg.createdAt).toDateString()
      if (dateStr !== lastDate) {
        groups.push({ type: 'date', date: msg.createdAt, key: dateStr })
        lastDate = dateStr
      }
      groups.push({ type: 'msg', msg })
    }
    return groups
  }

  const contacts = isOwner ? getOwnerContacts() : []

  // ── Render messages ────────────────────────────────────────────────
  const renderMessages = (msgList) => {
    if (loading) return (
      <div className={styles.loading}>Loading messages...</div>
    )

    if (msgList.length === 0) return (
      <div className={styles.emptyThread}>
        <MdChat className={styles.emptyIcon} />
        <p className={styles.emptyTitle}>No messages yet</p>
        <p className={styles.emptySubtitle}>
          {isOwner
            ? `Send a message to ${activeContact?.name || 'this employee'}`
            : 'Send a message to the owner'
          }
        </p>
      </div>
    )

    const grouped = groupMessages(msgList)

    return grouped.map((item, idx) => {
      if (item.type === 'date') return (
        <div key={item.key} className={styles.dateSep}>
          <div className={styles.dateSepLine} />
          <span className={styles.dateSepText}>{formatDate(item.date)}</span>
          <div className={styles.dateSepLine} />
        </div>
      )

      const { msg }  = item
      const isMine   = String(msg.senderId) === myId
      const isBcast  = msg.isBroadcast
      const prevItem = idx > 0 ? grouped[idx - 1] : null
      const prevMsg  = prevItem?.type === 'msg' ? prevItem.msg : null
      const showAvatar = !isMine && !isBcast &&
        (!prevMsg || String(prevMsg.senderId) !== String(msg.senderId))

      if (isBcast) return (
        <div key={msg._id || idx} className={`${styles.msgRow} ${styles.msgRowBroadcast}`}>
          <div className={`${styles.msgBubble} ${styles.msgBubbleBcast}`}>
            <div className={`${styles.msgContent} ${styles.msgContentBcast}`}>
              📢 {msg.content}
            </div>
            <div className={styles.msgMeta}>
              <span className={styles.msgTime}>
                {formatMsgTime(msg.createdAt)} · {msg.senderName}
              </span>
            </div>
          </div>
        </div>
      )

      return (
        <div
          key={msg._id || idx}
          className={`${styles.msgRow} ${isMine ? styles.msgRowMine : styles.msgRowOther}`}
        >
          {!isMine && (
            <div className={`
              ${styles.msgAvatar}
              ${getAvatarClass(msg.senderRole)}
              ${!showAvatar ? styles.msgAvatarHidden : ''}
            `}>
              {getInitials(msg.senderName)}
            </div>
          )}

          <div className={`${styles.msgBubble} ${isMine ? styles.msgBubbleMine : styles.msgBubbleOther}`}>
            {!isMine && showAvatar && (
              <div className={styles.msgSenderName}>{msg.senderName}</div>
            )}
            <div className={`${styles.msgContent} ${isMine ? styles.msgContentMine : styles.msgContentOther}`}>
              {msg.content}
            </div>
            <div className={styles.msgMeta}>
              <span className={styles.msgTime}>{formatMsgTime(msg.createdAt)}</span>
              {isMine && (
                <span className={isRead(msg) ? styles.msgRead : styles.msgReadGray}>
                  {isRead(msg) ? <MdDoneAll /> : <MdDone />}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  // ── Staff owner contact — prefer conversation history, fall back to fetched ID
  const staffOwnerContact = conversations.find(c => !c.isBroadcast)
    ? {
        id:    conversations.find(c => !c.isBroadcast)?.otherId,
        name:  conversations.find(c => !c.isBroadcast)?.otherName || 'Store Owner',
        role:  'owner',
        store: ''
      }
    : ownerContact

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />

      <div className={styles.panel}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <MdChat className={styles.headerIcon} />
            <span className={styles.headerTitle}>Team Messages</span>
          </div>
          <button className={styles.headerClose} onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className={styles.body}>

          {/* ── LEFT sidebar ────────────────────────────────────── */}
          <div className={styles.sidebar}>

            {isOwner && (
              <div className={styles.sidebarSearch}>
                <div style={{ position: 'relative' }}>
                  <MdSearch style={{
                    position: 'absolute', left: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', fontSize: '16px', pointerEvents: 'none'
                  }} />
                  <input
                    className={styles.searchInput}
                    style={{ paddingLeft: '32px' }}
                    placeholder="Search staff..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={styles.contactList}>

              {/* Broadcast — owner: pinned top */}
              {isOwner && (
                <div
                  className={`${styles.broadcastContact} ${broadcastMode ? styles.broadcastContactActive : ''}`}
                  onClick={() => {
                    setBroadcastMode(true)
                    setTimeout(() => setActiveContact(null), 0)
                  }}
                >
                  <div className={`${styles.avatar} ${styles.avatarBroadcast}`}>
                    <MdCampaign />
                  </div>
                  <div className={styles.contactInfo}>
                    <div className={styles.contactTopRow}>
                      <span className={styles.contactName}>All Staff</span>
                    </div>
                    <div className={styles.contactPreview}>Broadcast message</div>
                  </div>
                </div>
              )}

              {/* Owner: staff contact list */}
              {isOwner && contacts.map(contact => (
                <div
                  key={contact.id}
                  className={`${styles.contactItem} ${
                    activeContact?.id === contact.id && !broadcastMode
                      ? styles.contactItemActive : ''
                  }`}
                  onClick={() => {
                    setBroadcastMode(false)
                    setTimeout(() => setActiveContact(contact), 0)
                  }}
                >
                  <div className={`${styles.avatar} ${getAvatarClass(contact.role)}`}>
                    {getInitials(contact.name)}
                    <div className={styles.onlineDot} />
                  </div>
                  <div className={styles.contactInfo}>
                    <div className={styles.contactTopRow}>
                      <span className={styles.contactName}>{contact.name}</span>
                      {contact.lastTime && (
                        <span className={styles.contactTime}>{formatTime(contact.lastTime)}</span>
                      )}
                    </div>
                    <div className={`${styles.contactPreview} ${contact.unread > 0 ? styles.contactPreviewUnread : ''}`}>
                      {contact.lastMessage || `${contact.role} · ${contact.store}`}
                    </div>
                  </div>
                  {contact.unread > 0 && (
                    <div className={styles.unreadBadge}>
                      {contact.unread > 9 ? '9+' : contact.unread}
                    </div>
                  )}
                </div>
              ))}

              {/* Staff: owner contact */}
              {!isOwner && (
                <div
                  className={`${styles.contactItem} ${
                    activeContact && !broadcastMode ? styles.contactItemActive : ''
                  }`}
                  onClick={() => {
                    setBroadcastMode(false)
                    if (staffOwnerContact) {
                      setTimeout(() => setActiveContact(staffOwnerContact), 0)
                    }
                  }}
                >
                  <div className={`${styles.avatar} ${styles.avatarOwner}`}>
                    {getInitials(staffOwnerContact?.name || 'Store Owner')}
                    <div className={styles.onlineDot} />
                  </div>
                  <div className={styles.contactInfo}>
                    <div className={styles.contactTopRow}>
                      <span className={styles.contactName}>
                        {staffOwnerContact?.name || 'Store Owner'}
                      </span>
                      {conversations[0]?.lastMessageAt && (
                        <span className={styles.contactTime}>
                          {formatTime(conversations[0].lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className={`${styles.contactPreview} ${
                      conversations[0]?.unreadCount > 0 ? styles.contactPreviewUnread : ''
                    }`}>
                      {conversations[0]?.lastMessage || 'Tap to message the owner'}
                    </div>
                  </div>
                  {(conversations[0]?.unreadCount || 0) > 0 && (
                    <div className={styles.unreadBadge}>
                      {conversations[0].unreadCount > 9 ? '9+' : conversations[0].unreadCount}
                    </div>
                  )}
                </div>
              )}

              {/* Staff: announcements */}
              {!isOwner && (
                <div
                  className={`${styles.broadcastContact} ${broadcastMode ? styles.broadcastContactActive : ''}`}
                  onClick={() => {
                    setBroadcastMode(true)
                    setTimeout(() => setActiveContact(null), 0)
                  }}
                >
                  <div className={`${styles.avatar} ${styles.avatarBroadcast}`}>
                    <MdCampaign />
                  </div>
                  <div className={styles.contactInfo}>
                    <div className={styles.contactTopRow}>
                      <span className={styles.contactName}>Announcements</span>
                    </div>
                    <div className={styles.contactPreview}>Messages from owner</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT panel ─────────────────────────────────────── */}
          {broadcastMode ? (

            <div className={styles.broadcastPane}>
              <div className={styles.broadcastHeader}>
                <div className={styles.broadcastHeaderIcon}><MdCampaign /></div>
                <div>
                  <div className={styles.threadName}>
                    {isOwner ? 'Broadcast to All Staff' : 'Announcements'}
                  </div>
                  <div className={styles.threadRole}>
                    {isOwner
                      ? 'All employees will receive this message'
                      : 'Messages from the owner'
                    }
                  </div>
                </div>
              </div>

              <div className={styles.broadcastMessages}>
                {loading ? (
                  <div className={styles.loading}>Loading...</div>
                ) : broadcastHistory.length === 0 ? (
                  <div className={styles.broadcastEmpty}>
                    <MdCampaign style={{ fontSize: '3rem', opacity: 0.15 }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      No broadcasts yet
                    </p>
                  </div>
                ) : broadcastHistory.map((msg, idx) => (
                  <div key={msg._id || idx} className={`${styles.msgRow} ${styles.msgRowBroadcast}`}>
                    <div className={`${styles.msgBubble} ${styles.msgBubbleBcast}`}>
                      <div className={`${styles.msgContent} ${styles.msgContentBcast}`}>
                        {msg.content}
                      </div>
                      <div className={styles.msgMeta}>
                        <span className={styles.msgTime}>
                          {formatMsgTime(msg.createdAt)} · {msg.senderName}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {isOwner && (
                <div className={styles.broadcastInputArea}>
                  <div className={styles.broadcastInputRow}>
                    <textarea
                      className={styles.textarea}
                      placeholder="Type a broadcast message... (Enter to send)"
                      value={broadcastInput}
                      onChange={e => setBroadcastInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                    />
                    <button
                      className={styles.broadcastSendBtn}
                      onClick={handleBroadcast}
                      disabled={!broadcastInput.trim() || sending}
                    >
                      <MdSend />
                    </button>
                  </div>
                </div>
              )}
            </div>

          ) : activeContact ? (

            <div className={styles.thread}>
              <div className={styles.threadHeader}>
                <div className={styles.threadHeaderLeft}>
                  <div className={`${styles.avatar} ${getAvatarClass(activeContact.role)}`}>
                    {getInitials(activeContact.name)}
                    <div className={styles.onlineDot} />
                  </div>
                  <div>
                    <div className={styles.threadName}>{activeContact.name}</div>
                    <div className={styles.threadRole}>{activeContact.role}</div>
                    {activeContact.store && (
                      <div className={styles.threadStore}>{activeContact.store}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.messages}>
                {renderMessages(messages)}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputArea}>
                <div className={styles.inputRow}>
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    placeholder={`Message ${activeContact.name}...`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                  >
                    <MdSend />
                  </button>
                </div>
              </div>
            </div>

          ) : (

            <div className={styles.noThread}>
              <div className={styles.noThreadIcon}>
                <MdChat />
              </div>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {isOwner ? 'Select a staff member to chat' : 'Select a conversation'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', lineHeight: 1.6 }}>
                {isOwner
                  ? 'Choose from the staff list on the left to start a conversation'
                  : 'Tap a contact on the left to open the chat'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
