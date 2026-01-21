export interface User {
  id: number
  username: string
  theme: string
  selected_model: string
}

export interface Chat {
  id: number
  title: string
  created_at: string
  user_id: number
  space_id?: number
}

export interface Message {
  id: number
  content: string
  role: 'user' | 'assistant'
  chat_id: number
  created_at: string
}

export interface Space {
  id: number
  name: string
  user_id: number
  chats?: Chat[]
}

export interface Model {
  id: string
  name: string
}

export interface AppState {
  user: User | null
  isAuthenticated: boolean
  chats: Chat[]
  spaces: Space[]
}
