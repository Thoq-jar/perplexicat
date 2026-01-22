import { useState } from 'preact/hooks'
import { Trash2, LogOut } from 'lucide-preact'
import { updateTheme, deleteAllChats, logout } from '../api'
import type { User, Chat } from '../types'

interface SettingsProps {
  path?: string
  user: User
  setUser: (user: User) => void
  chats: Chat[]
  setChats: (chats: Chat[]) => void
}

export function Settings({ user, setUser, setChats }: SettingsProps) {
  const [theme, setTheme] = useState(user.theme || 'system')

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    try {
      await updateTheme(newTheme)
      setUser({ ...user, theme: newTheme })
    } catch (err) {
      console.error('Failed to update theme:', err)
    }
  }

  const handleDeleteAllChats = async () => {
    if (!confirm('Are you sure you want to delete ALL chats? This cannot be undone.')) return

    try {
      await deleteAllChats()
      setChats([])
    } catch (err) {
      console.error('Failed to delete all chats:', err)
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div class="max-w-3xl mx-auto px-4 py-8 md:px-8">
      <div class="mb-12">
        <h1 class="text-3xl font-light tracking-tight text-[var(--text-color)]">Settings</h1>
      </div>

      <div class="flex flex-col gap-16">
        <div class="flex flex-col gap-6">
          <h2 class="text-xl text-[var(--muted-color)] font-medium px-1">Appearance</h2>
          <div class="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-8 gap-6">
              <div class="flex flex-col gap-2">
                <span class="font-semibold text-lg text-[var(--text-color)]">Theme</span>
                <span class="text-sm text-[var(--muted-color)] leading-relaxed max-w-sm">
                  Choose between light, dark, or follow your system preference.
                </span>
              </div>
              <select
                class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-color)] cursor-pointer outline-none hover:bg-[var(--hover-bg)] min-w-[140px] transition-colors focus:border-[var(--accent-color)]"
                value={theme}
                onChange={(e) => handleThemeChange((e.target as HTMLSelectElement).value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <h2 class="text-xl text-[var(--muted-color)] font-medium px-1">Data Management</h2>
          <div class="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-8 gap-6">
              <div class="flex flex-col gap-2">
                <span class="font-semibold text-lg text-[var(--text-color)] text-[var(--danger-color)]">Delete All Chats</span>
                <span class="text-sm text-[var(--muted-color)] leading-relaxed max-w-sm">
                  This will permanently delete all your conversations. This action cannot be undone.
                </span>
              </div>
              <button 
                class="flex items-center justify-center gap-2 px-6 py-3 bg-transparent text-[var(--danger-color)] border border-[var(--danger-color)]/30 hover:bg-[var(--danger-color)] hover:text-white rounded-xl text-sm font-semibold transition-all shrink-0"
                onClick={handleDeleteAllChats}
              >
                <Trash2 size={18} />
                Delete All
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <h2 class="text-xl text-[var(--muted-color)] font-medium px-1">Account</h2>
          <div class="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-8 gap-6">
              <div class="flex flex-col gap-2">
                <span class="font-semibold text-lg text-[var(--text-color)]">Session</span>
                <span class="text-sm text-[var(--muted-color)] leading-relaxed">
                  Currently logged in as <span class="text-[var(--text-color)] font-medium">{user.username}</span>
                </span>
              </div>
              <button 
                class="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bg-tertiary)] text-[var(--text-color)] border border-[var(--border-color)] hover:bg-[var(--hover-bg)] rounded-xl text-sm font-semibold transition-all shrink-0"
                onClick={handleLogout}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
