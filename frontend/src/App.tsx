import { useState, useEffect, useCallback } from 'preact/hooks'
import Router from 'preact-router'
import { getCurrentUser, getChats, getSpaces } from './api'
import type { User, Chat, Space } from './types'
import { Sidebar } from './components/Sidebar'
import { Main } from './pages/Main'
import { ChatPage } from './pages/Chat'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Library } from './pages/Library'
import { Spaces } from './pages/Spaces'
import { SpacePage } from './pages/Space'
import { Settings } from './pages/Settings'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user && !dataLoaded) {
      loadData()
    }
  }, [user, dataLoaded])

  useEffect(() => {
    if (user && user.theme) {
      if (user.theme === 'system') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', user.theme)
      }
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [chatsData, spacesData] = await Promise.all([getChats(), getSpaces()])
      setChats(chatsData)
      setSpaces(spacesData)
      setDataLoaded(true)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  const refreshData = useCallback(async () => {
    try {
      const [chatsData, spacesData] = await Promise.all([getChats(), getSpaces()])
      setChats(chatsData)
      setSpaces(spacesData)
    } catch (err) {
      console.error('Failed to refresh data:', err)
    }
  }, [])

  if (isLoading) {
    return (
      <div class="flex min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
        <div class="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          <div class="max-w-5xl mx-auto px-4 py-8 md:px-8 w-full flex items-center justify-center h-screen">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Router>
        <Register path="/register" />
        <Login path="/" />
        <Login default />
      </Router>
    )
  }

  return (
    <div class="flex min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] font-sans antialiased selection:bg-[var(--accent-color)] selection:text-white">
      <Sidebar chats={chats} spaces={spaces} />
      <div class="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <Router>
          <Main
            path="/"
            user={user}
            chats={chats}
            setChats={setChats}
            spaces={spaces}
            setSpaces={setSpaces}
            refreshData={refreshData}
          />
          <ChatPage
            path="/chat/:id"
            user={user}
            chats={chats}
            setChats={setChats}
            spaces={spaces}
            refreshData={refreshData}
          />
          <Library
            path="/library"
            chats={chats}
            setChats={setChats}
            spaces={spaces}
            refreshData={refreshData}
          />
          <Spaces
            path="/spaces"
            spaces={spaces}
            setSpaces={setSpaces}
            refreshData={refreshData}
          />
          <SpacePage
            path="/space/:id"
            spaces={spaces}
            setSpaces={setSpaces}
            refreshData={refreshData}
          />
          <Settings
            path="/settings"
            user={user}
            setUser={setUser}
            chats={chats}
            setChats={setChats}
          />
        </Router>
      </div>
    </div>
  )
}
