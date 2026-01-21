import { useState, useRef } from 'preact/hooks'
import { route } from 'preact-router'
import { ArrowUp } from 'lucide-preact'
import { streamChat } from '../api'
import type { User, Chat, Space } from '../types'

interface MainProps {
  path?: string
  user: User
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  spaces: Space[]
  setSpaces: (spaces: Space[]) => void
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

export function Main({ user, refreshData }: MainProps) {
  const [message, setMessage] = useState('')
  const [model, setModel] = useState(getValidModel(user.selected_model))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    
    await streamChat(message, model, undefined, {
      onChatCreated: (newChatId) => {
        refreshData()
        route(`/chat/${newChatId}`)
      },
      onError: () => {
        setIsSubmitting(false)
      },
      onComplete: () => {
        setIsSubmitting(false)
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

  return (
    <div class="container">
      <h1 class="title">Perplexicat</h1>
      <div class="input-wrapper">
        <div class="selector-group">
          <select
            class="model-select"
            value={model}
            onChange={(event) => setModel((event.target as HTMLSelectElement).value)}
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
              placeholder="Ask anything..."
              value={message}
              onInput={(e) => {
                setMessage((e.target as HTMLTextAreaElement).value)
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
              disabled={!message.trim() || isSubmitting}
            >
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
