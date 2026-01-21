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
      <div class="layout">
        <div class="main-content">
          <div class="container">
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
    <div class="layout">
      <Sidebar chats={chats} spaces={spaces} />
      <div class="main-content">
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
