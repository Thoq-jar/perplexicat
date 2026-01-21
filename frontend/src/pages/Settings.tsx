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
    <div class="page-container">
      <div class="page-header">
        <h1>Settings</h1>
      </div>

      <div class="settings-content">
        <div class="settings-section">
          <h2>Appearance</h2>
          <div class="settings-card">
            <div class="settings-item">
              <div class="settings-item-label">
                <span>Theme</span>
                <span>Choose your preferred color scheme</span>
              </div>
              <select
                class="model-select"
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

        <div class="settings-section">
          <h2>Data</h2>
          <div class="settings-card">
            <div class="settings-item">
              <div class="settings-item-label">
                <span>Delete All Chats</span>
                <span>Permanently remove all your chat history</span>
              </div>
              <button class="delete-btn" onClick={handleDeleteAllChats}>
                <Trash2 />
                Delete All
              </button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h2>Account</h2>
          <div class="settings-card">
            <div class="settings-item">
              <div class="settings-item-label">
                <span>Logged in as {user.username}</span>
                <span>Sign out of your account</span>
              </div>
              <button class="delete-btn" onClick={handleLogout}>
                <LogOut />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
