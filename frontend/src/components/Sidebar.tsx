import { Cat, Plus, Library, Layers, Settings } from 'lucide-preact'
import type { Chat, Space } from '../types'

interface SidebarProps {
  chats: Chat[]
  spaces: Space[]
}

export function Sidebar({ }: SidebarProps) {
  return (
    <aside class="sidebar">
      <div class="sidebar-top">
        <a href="/" class="sidebar-logo">
          <Cat />
        </a>
        <a href="/" class="sidebar-btn" title="New Chat">
          <Plus />
        </a>
      </div>
      <nav class="sidebar-nav">
        <a href="/library" class="sidebar-item">
          <Library />
          <span>Library</span>
        </a>
        <a href="/spaces" class="sidebar-item">
          <Layers />
          <span>Spaces</span>
        </a>
      </nav>
      <div class="sidebar-bottom">
        <a href="/settings" class="sidebar-item">
          <Settings />
          <span>Settings</span>
        </a>
      </div>
    </aside>
  )
}
