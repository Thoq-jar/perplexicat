import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { Layers, MessageSquare, Clock, X, Trash2 } from 'lucide-preact'
import { getSpace, moveChatToSpace, deleteSpace } from '../api'
import type { Space, Chat } from '../types'

interface SpacePageProps {
  path?: string
  id?: string
  spaces: Space[]
  setSpaces: (spaces: Space[]) => void
  refreshData: () => Promise<void>
}

export function SpacePage({ id, spaces, setSpaces, refreshData }: SpacePageProps) {
  const spaceId = parseInt(id || '0')
  const [space, setSpace] = useState<Space | null>(null)
  const [chats, setChats] = useState<Chat[]>([])

  useEffect(() => {
    if (spaceId) {
      loadSpace()
    }
  }, [spaceId])

  const loadSpace = async () => {
    try {
      const data = await getSpace(spaceId)
      setSpace(data.space)
      setChats(data.chats)
    } catch (err) {
      console.error('Failed to load space:', err)
    }
  }

  const handleRemoveChat = async (chatId: number, event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    try {
      await moveChatToSpace(chatId, null)
      setChats(chats.filter((c) => c.id !== chatId))
      refreshData()
    } catch (err) {
      console.error('Failed to remove chat from space:', err)
    }
  }

  const handleDeleteSpace = async () => {
    if (!confirm('Are you sure you want to delete this space? Chats will be unassigned but not deleted.')) return

    try {
      await deleteSpace(spaceId)
      setSpaces(spaces.filter((s) => s.id !== spaceId))
      refreshData()
      route('/spaces')
    } catch (err) {
      console.error('Failed to delete space:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (!space) {
    return (
      <div class="page-container">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div class="page-container space-page-container">
      <div class="space-header">
        <div class="space-header-left">
          <div class="space-icon-large">
            <Layers />
          </div>
          <div>
            <h1 class="space-title">{space.name}</h1>
            <p class="space-subtitle">{chats.length} chats</p>
          </div>
        </div>
        <button class="delete-btn" onClick={handleDeleteSpace}>
          <Trash2 />
          Delete Space
        </button>
      </div>

      <div class="chats-grid">
        {chats.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon">
              <MessageSquare />
            </div>
            <h3 class="empty-state-title">No chats in this space</h3>
            <p class="empty-state-text">Add chats to this space from the chat view</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div key={chat.id} class="chat-card">
              <a href={`/chat/${chat.id}`} class="chat-card-link">
                <div class="chat-card-inner">
                  <div class="chat-icon">
                    <MessageSquare />
                  </div>
                  <div class="chat-card-content">
                    <h3 class="chat-card-title">{chat.title || 'Untitled Chat'}</h3>
                    <p class="chat-card-meta">
                      <Clock />
                      {formatDate(chat.created_at)}
                    </p>
                  </div>
                </div>
              </a>
              <button
                class="remove-from-space-btn"
                onClick={(event) => handleRemoveChat(chat.id, event)}
                title="Remove from space"
              >
                <X />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
