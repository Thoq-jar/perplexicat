import { MessageSquare, Trash2, Clock } from 'lucide-preact'
import { deleteChat, deleteAllChats } from '../api'
import type { Chat, Space } from '../types'

interface LibraryProps {
  path?: string
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  spaces: Space[]
  refreshData: () => Promise<void>
}

export function Library({ chats, setChats, spaces, refreshData }: LibraryProps) {
  const handleDeleteChat = async (chatId: number, e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this chat?')) return

    try {
      await deleteChat(chatId)
      setChats(chats.filter((c) => c.id !== chatId))
      refreshData()
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL chats? This cannot be undone.')) return

    try {
      await deleteAllChats()
      setChats([])
      refreshData()
    } catch (err) {
      console.error('Failed to delete all chats:', err)
    }
  }

  const getSpaceName = (spaceId?: number) => {
    if (!spaceId) return null
    const space = spaces.find((s) => s.id === spaceId)
    return space?.name || null
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div class="page-container">
      <div class="page-header">
        <h1>Library</h1>
        {chats.length > 0 && (
          <button class="action-btn danger" onClick={handleDeleteAll}>
            <Trash2 />
            Delete All
          </button>
        )}
      </div>

      <div class="card-grid">
        {chats.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon">
              <MessageSquare />
            </div>
            <h3 class="empty-state-title">No chats yet</h3>
            <p class="empty-state-text">Start a conversation to see it here</p>
          </div>
        ) : (
          chats.map((chat) => (
            <a key={chat.id} href={`/chat/${chat.id}`} class="card">
              <button
                class="card-delete-btn"
                onClick={(e) => handleDeleteChat(chat.id, e)}
                title="Delete chat"
              >
                <Trash2 />
              </button>
              <div class="card-icon">
                <MessageSquare />
              </div>
              <div class="card-content">
                <h3>{chat.title || 'Untitled Chat'}</h3>
                <p>
                  <Clock style={{ width: '14px', height: '14px', display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {formatDate(chat.created_at)}
                  {getSpaceName(chat.space_id) && ` · ${getSpaceName(chat.space_id)}`}
                </p>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
