import { Cat, Plus, Library, Layers, Settings } from 'lucide-preact'
import type { Chat, Space } from '../types'

interface SidebarProps {
  chats: Chat[]
  spaces: Space[]
}

export function Sidebar({ }: SidebarProps) {
  return (
    <aside class="w-[72px] bg-[var(--bg-secondary)] flex flex-col items-center py-4 sticky top-0 h-screen shrink-0 border-none z-50">
      <div class="flex flex-col items-center gap-3">
        <a href="/" class="w-[42px] h-[42px] flex items-center justify-center text-[var(--accent-color)] hover:opacity-80 transition-opacity">
          <Cat size={28} />
        </a>
        <a 
          href="/" 
          class="w-[42px] h-[42px] rounded-[10px] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-color)] hover:bg-[var(--hover-bg)] transition-colors" 
          title="New Chat"
        >
          <Plus size={20} />
        </a>
      </div>
      <nav class="flex flex-col gap-2 mt-6 w-full px-2">
        <a href="/library" class="flex flex-col items-center gap-1 p-2 rounded-lg text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-[var(--hover-bg)] transition-all no-underline group">
          <Library size={22} />
          <span class="text-[10px] font-medium opacity-80 group-hover:opacity-100">Library</span>
        </a>
        <a href="/spaces" class="flex flex-col items-center gap-1 p-2 rounded-lg text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-[var(--hover-bg)] transition-all no-underline group">
          <Layers size={22} />
          <span class="text-[10px] font-medium opacity-80 group-hover:opacity-100">Spaces</span>
        </a>
      </nav>
      <div class="mt-auto mb-2 w-full px-2">
        <a href="/settings" class="flex flex-col items-center gap-1 p-2 rounded-lg text-[var(--muted-color)] hover:text-[var(--text-color)] hover:bg-[var(--hover-bg)] transition-all no-underline group">
          <Settings size={22} />
          <span class="text-[10px] font-medium opacity-80 group-hover:opacity-100">Settings</span>
        </a>
      </div>
    </aside>
  )
}