import { useState, useMemo } from 'preact/hooks'
import { MessageSquare, Trash2, Clock, Search } from 'lucide-preact'
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
  const [searchQuery, setSearchQuery] = useState('')

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

  const groupedChats = useMemo(() => {
    const filtered = chats.filter(chat => 
      (chat.title || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const groups: Record<string, Chat[]> = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Previous 30 Days': [],
      'Older': []
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const last7Days = new Date(today)
    last7Days.setDate(last7Days.getDate() - 7)
    const last30Days = new Date(today)
    last30Days.setDate(last30Days.getDate() - 30)

    filtered.forEach(chat => {
      const chatDate = new Date(chat.created_at)
      if (chatDate >= today) {
        groups['Today'].push(chat)
      } else if (chatDate >= yesterday) {
        groups['Yesterday'].push(chat)
      } else if (chatDate >= last7Days) {
        groups['Previous 7 Days'].push(chat)
      } else if (chatDate >= last30Days) {
        groups['Previous 30 Days'].push(chat)
      } else {
        groups['Older'].push(chat)
      }
    })

    return groups
  }, [chats, searchQuery])

  return (
    <div class="max-w-5xl mx-auto px-4 py-8 md:px-8">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 class="text-3xl font-light tracking-tight text-[var(--text-color)]">Library</h1>
        <div class="flex items-center gap-4 w-full md:w-auto">
           <div class="flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-2 rounded-lg border border-[var(--border-color)] focus-within:border-[var(--accent-color)] w-full md:w-64 transition-colors">
            <Search size={16} class="text-[var(--muted-color)]" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchQuery}
              class="bg-transparent border-none text-[var(--text-color)] text-sm outline-none w-full placeholder-[var(--muted-color)]"
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          {chats.length > 0 && (
            <button 
              class="flex items-center gap-2 px-3 py-2 bg-transparent text-[var(--danger-color)] border border-[var(--border-color)] hover:bg-[var(--danger-color)] hover:text-white hover:border-[var(--danger-color)] rounded-lg text-sm font-medium transition-all" 
              onClick={handleDeleteAll}
            >
              <Trash2 size={16} />
              <span class="hidden sm:inline">Delete All</span>
            </button>
          )}
        </div>
      </div>

      <div class="flex flex-col gap-8">
        {chats.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-16 text-center text-[var(--muted-color)]">
            <div class="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <MessageSquare size={32} class="opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-[var(--text-color)] mb-2">No chats yet</h3>
            <p class="text-sm">Start a conversation to see it here</p>
          </div>
        ) : (
          Object.entries(groupedChats).map(([group, groupChats]) => (
            groupChats.length > 0 && (
              <div key={group} class="mb-4">
                <h2 class="text-sm font-semibold text-[var(--muted-color)] uppercase tracking-wider mb-4 pl-1">{group}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupChats.map((chat) => (
                    <a 
                      key={chat.id} 
                      href={`/chat/${chat.id}`} 
                      class="group relative flex items-center gap-4 p-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] transition-all decoration-0"
                    >
                      <button
                        class="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[var(--muted-color)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--danger-color)] opacity-0 group-hover:opacity-100 transition-all z-10"
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        title="Delete chat"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div class="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-color)] shrink-0">
                        <MessageSquare size={20} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <h3 class="font-medium text-[var(--text-color)] truncate mb-1 pr-8">{chat.title || 'Untitled Chat'}</h3>
                        <p class="text-xs text-[var(--muted-color)] flex items-center gap-2">
                          <span class="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(chat.created_at)}
                          </span>
                          {getSpaceName(chat.space_id) && (
                            <span class="bg-[var(--bg-tertiary)] text-[var(--text-color)] px-1.5 py-0.5 rounded text-[10px]">
                              {getSpaceName(chat.space_id)}
                            </span>
                          )}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  )
}