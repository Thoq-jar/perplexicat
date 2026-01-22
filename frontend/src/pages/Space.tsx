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
      <div class="max-w-5xl mx-auto px-4 py-8 md:px-8">
        <p class="text-[var(--muted-color)]">Loading...</p>
      </div>
    )
  }

  return (
    <div class="max-w-5xl mx-auto px-4 py-8 md:px-8">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-none">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-[var(--accent-color)] flex items-center justify-center text-white shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <h1 class="text-3xl font-medium tracking-tight text-[var(--text-color)] m-0">{space.name}</h1>
            <p class="text-sm text-[var(--muted-color)] mt-1">{chats.length} chat{chats.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button 
          class="flex items-center gap-2 px-3 py-2 bg-transparent text-[var(--danger-color)] border border-[var(--border-color)] hover:bg-[var(--danger-color)] hover:text-white hover:border-[var(--danger-color)] rounded-lg text-sm font-medium transition-all"
          onClick={handleDeleteSpace}
        >
          <Trash2 size={18} />
          Delete Space
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {chats.length === 0 ? (
          <div class="col-span-full flex flex-col items-center justify-center py-16 text-center text-[var(--muted-color)]">
            <div class="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <MessageSquare size={32} class="opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-[var(--text-color)] mb-2">No chats in this space</h3>
            <p class="text-sm">Add chats to this space from the chat view</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div key={chat.id} class="relative group">
              <a 
                href={`/chat/${chat.id}`} 
                class="block decoration-0 text-inherit hover:no-underline"
              >
                <div class="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] transition-all bg-transparent">
                  <div class="w-10 h-10 rounded-lg bg-[var(--accent-color)] flex items-center justify-center text-white shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-[var(--text-color)] truncate mb-1 text-sm">{chat.title || 'Untitled Chat'}</h3>
                    <p class="text-xs text-[var(--muted-color)] flex items-center gap-1.5">
                      <Clock size={14} />
                      {formatDate(chat.created_at)}
                    </p>
                  </div>
                </div>
              </a>
              <button
                class="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-transparent border-none flex items-center justify-center cursor-pointer text-[var(--muted-color)] opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-[var(--bg-tertiary)] hover:text-[var(--danger-color)]"
                onClick={(event) => handleRemoveChat(chat.id, event)}
                title="Remove from space"
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}