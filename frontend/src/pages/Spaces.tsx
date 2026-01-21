import { useState } from 'preact/hooks'
import { Layers, Plus, Trash2 } from 'lucide-preact'
import { createSpace, deleteSpace } from '../api'
import type { Space } from '../types'

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

  return (
    <div class="page-container">
      <div class="page-header">
        <h1>Spaces</h1>
        <button class="action-btn" onClick={() => setIsModalOpen(true)}>
          <Plus />
          New Space
        </button>
      </div>

      <div class="card-grid">
        {spaces.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon">
              <Layers />
            </div>
            <h3 class="empty-state-title">No spaces yet</h3>
            <p class="empty-state-text">Create a space to organize your chats</p>
          </div>
        ) : (
          spaces.map((space) => (
            <a key={space.id} href={`/space/${space.id}`} class="card">
              <button
                class="card-delete-btn"
                onClick={(event) => handleDeleteSpace(space.id, event)}
                title="Delete space"
              >
                <Trash2 />
              </button>
              <div class="card-icon">
                <Layers />
              </div>
              <div class="card-content">
                <h3>{space.name}</h3>
                <p>{space.chats?.length || 0} chats</p>
              </div>
            </a>
          ))
        )}
      </div>

      <div class={`modal ${isModalOpen ? 'open' : ''}`} onClick={() => setIsModalOpen(false)}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="auth-container">
            <h2>Create Space</h2>
            <form onSubmit={handleCreateSpace}>
              <div class="form-group">
                <input
                  type="text"
                  class="input-component"
                  placeholder="Space name"
                  value={newSpaceName}
                  onInput={(e) => setNewSpaceName((e.target as HTMLInputElement).value)}
                  required
                />
              </div>
              <div class="modal-form-actions">
                <button
                  type="button"
                  class="auth-btn auth-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" class="auth-btn" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
