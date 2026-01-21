import { useState, useEffect, useRef } from 'preact/hooks'
import { ArrowUp, Sparkles } from 'lucide-preact'
import { marked } from 'marked'
import { getChat, streamChat, moveChatToSpace } from '../api'
import type { User, Chat, Space, Message } from '../types'

interface ChatPageProps {
  path?: string
  id?: string
  user: User
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  spaces: Space[]
  refreshData: () => Promise<void>
}

const OLLAMA_MODELS = [
  { id: 'qwen3-vl:8b', name: 'Qwen3 VL 8B' },
  { id: 'gemma:4b', name: 'Gemma 4B' },
]

const getValidModel = (selectedModel: string | undefined) => {
  if (selectedModel && OLLAMA_MODELS.some(m => m.id === selectedModel)) {
    return selectedModel
  }
  return OLLAMA_MODELS[0].id
}

export function ChatPage({ id, user, chats, setChats, spaces, refreshData }: ChatPageProps) {
  const chatId = parseInt(id || '0')
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [model, setModel] = useState(getValidModel(user.selected_model))
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (chatId) {
      loadChat()
    }
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const loadChat = async () => {
    try {
      const data = await getChat(chatId)
      setChat(data.chat)
      setMessages(data.messages)
      setSelectedSpace(data.chat.space_id || null)
    } catch (err) {
      console.error('Failed to load chat:', err)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSpaceChange = async (spaceId: string) => {
    const newSpaceId = spaceId === '' ? null : parseInt(spaceId)
    setSelectedSpace(newSpaceId)
    try {
      await moveChatToSpace(chatId, newSpaceId)
      if (chat) {
        setChat({ ...chat, space_id: newSpaceId || undefined })
        setChats(chats.map((c) => (c.id === chatId ? { ...c, space_id: newSpaceId || undefined } : c)))
      }
    } catch (err) {
      console.error('Failed to move chat:', err)
    }
  }

  const handleSubmit = async () => {
    if (!inputMessage.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now(),
      content: inputMessage,
      role: 'user',
      chat_id: chatId,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const messageToSend = inputMessage
    setInputMessage('')
    setIsStreaming(true)
    setStreamingContent('')

    await streamChat(messageToSend, model, chatId, {
      onChunk: (chunk) => {
        setStreamingContent((prev) => prev + chunk)
      },
      onComplete: (response) => {
        const assistantMessage: Message = {
          id: Date.now() + 1,
          content: response.content,
          role: 'assistant',
          chat_id: chatId,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStreamingContent('')
        setIsStreaming(false)
        refreshData()
      },
      onError: () => {
        setIsStreaming(false)
      },
    })
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const renderMarkdown = (content: string) => {
    return { __html: marked.parse(content) as string }
  }

  return (
    <div class="chat-container">
      <div class="chat-header">
        <select
          class="model-select chat-header-select"
          value={selectedSpace?.toString() || ''}
          onChange={(e) => handleSpaceChange((e.target as HTMLSelectElement).value)}
        >
          <option value="">No Space</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id.toString()}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      <div class="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} class={`message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div class="message-header">
                <div class="avatar ai">
                  <Sparkles class="avatar-icon" />
                </div>
                <span>Assistant</span>
              </div>
            )}
            <div class="message-content">
              {msg.role === 'assistant' ? (
                <div
                  class="markdown-content"
                  dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div class="message assistant">
            <div class="message-header">
              <div class="avatar ai">
                <Sparkles class="avatar-icon" />
              </div>
              <span>Assistant</span>
            </div>
            <div class="message-content">
              <div
                class="markdown-content"
                dangerouslySetInnerHTML={renderMarkdown(streamingContent)}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div class="chat-input-wrapper">
        <div class="input-wrapper">
          <div class="selector-group">
            <select
              class="model-select"
              value={model}
              onChange={(e) => setModel((e.target as HTMLSelectElement).value)}
            >
              {OLLAMA_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div class="input-row">
            <div class="textarea-wrapper">
              <textarea
                ref={textareaRef}
                class="input-component"
                placeholder="Continue the conversation..."
                value={inputMessage}
                onInput={(e) => {
                  setInputMessage((e.target as HTMLTextAreaElement).value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                rows={1}
              />
            </div>
            <div class="action-group">
              <button
                class="submit-btn"
                onClick={handleSubmit}
                disabled={!inputMessage.trim() || isStreaming}
              >
                <ArrowUp />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
