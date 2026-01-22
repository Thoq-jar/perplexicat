import { useState, useMemo } from 'preact/hooks'
import { Layers, Plus, Trash2, Search, Folder } from 'lucide-preact'
import { createSpace, deleteSpace } from '../api'
import type { Space, Chat } from '../types'

interface SpacesProps {
  path?: string
  spaces: Space[]
  setSpaces: (spaces: Space[]) => void
  refreshData: () => Promise<void>
}

export function Spaces({ spaces, setSpaces, refreshData }: SpacesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleCreateSpace = async (event: Event) => {
    event.preventDefault()
    if (!newSpaceName.trim() || isCreating) return

    setIsCreating(true)
    try {
      const newSpace = await createSpace(newSpaceName.trim())
      setSpaces([...spaces, newSpace])
      setNewSpaceName('')
      setIsModalOpen(false)
      refreshData()
    } catch (err) {
      console.error('Failed to create space:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteSpace = async (spaceId: number, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!confirm('Are you sure you want to delete this space? Chats will be unassigned but not deleted.')) return

    try {
      await deleteSpace(spaceId)
      setSpaces(spaces.filter((s) => s.id !== spaceId))
      refreshData()
    } catch (err) {
      console.error('Failed to delete space:', err)
    }
  }

  const getSpaceColor = (name: string) => {
    const colors = [
      'var(--accent-color)',
      'lab(55 30 30)',
      'lab(50 20 -20)',
      'lab(45 -20 20)',
      'lab(50 -10 -10)',
      'lab(60 40 10)',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const filteredSpaces = useMemo(() => {
    return spaces.filter(space => 
      space.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [spaces, searchQuery])

  return (
    <div class="max-w-5xl mx-auto px-4 py-8 md:px-8">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 class="text-3xl font-light tracking-tight text-[var(--text-color)]">Spaces</h1>
        <div class="flex items-center gap-4 w-full md:w-auto">
          <div class="flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-2 rounded-lg border border-[var(--border-color)] focus-within:border-[var(--accent-color)] w-full md:w-64 transition-colors">
            <Search size={16} class="text-[var(--muted-color)]" />
            <input 
              type="text" 
              placeholder="Search spaces..." 
              value={searchQuery}
              class="bg-transparent border-none text-[var(--text-color)] text-sm outline-none w-full placeholder-[var(--muted-color)]"
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <button 
            class="flex items-center gap-2 px-3 py-2 bg-[var(--accent-color)] text-white hover:opacity-90 rounded-lg text-sm font-medium transition-all shadow-sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            <span class="whitespace-nowrap">New Space</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpaces.length === 0 ? (
          <div class="col-span-full flex flex-col items-center justify-center py-16 text-center text-[var(--muted-color)]">
            <div class="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <Layers size={32} class="opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-[var(--text-color)] mb-2">No spaces found</h3>
            <p class="text-sm">
              {searchQuery ? 'Try a different search term' : 'Create a space to organize your chats'}
            </p>
          </div>
        ) : (
          filteredSpaces.map((space) => (
            <a 
              key={space.id} 
              href={`/space/${space.id}`} 
              class="group relative flex items-center gap-4 p-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] transition-all decoration-0"
            >
              <button
                class="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[var(--muted-color)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--danger-color)] opacity-0 group-hover:opacity-100 transition-all z-10"
                onClick={(event) => handleDeleteSpace(space.id, event)}
                title="Delete space"
              >
                <Trash2 size={16} />
              </button>
              <div 
                class="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" 
                style={{ background: getSpaceColor(space.name) }}
              >
                <Folder size={20} />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-[var(--text-color)] truncate mb-1">{space.name}</h3>
                <p class="text-xs text-[var(--muted-color)]">
                  {space.chats && space.chats.length > 0 ? (
                    <span class="bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                      {space.chats.length} chat{space.chats.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    'Empty'
                  )}
                </p>
              </div>
            </a>
          ))
        )}
      </div>

      <div 
        class={`fixed inset-0 bg-black/50 z-50 flex items-center justify-center transition-opacity ${isModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
        onClick={() => setIsModalOpen(false)}
      >
        <div 
          class={`bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl p-8 w-full max-w-md m-4 transform transition-all ${isModalOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="text-xl font-medium mb-6 text-[var(--text-color)]">Create Space</h2>
          <form onSubmit={handleCreateSpace}>
            <div class="mb-4">
              <input
                type="text"
                class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--bg-secondary)] transition-all text-[var(--text-color)] placeholder-[var(--muted-color)]"
                placeholder="Space name"
                value={newSpaceName}
                onInput={(e) => setNewSpaceName((e.target as HTMLInputElement).value)}
                required
                autoFocus
              />
            </div>
            <div class="flex gap-3 mt-8">
              <button
                type="button"
                class="flex-1 px-4 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-color)] hover:bg-[var(--bg-secondary)] hover:border-[var(--muted-color)] transition-all font-medium"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                class="flex-1 px-4 py-3 rounded-xl bg-[var(--accent-color)] text-white hover:opacity-90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}