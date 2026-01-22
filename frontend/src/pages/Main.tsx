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
  { id: 'gemma3:4b', name: 'Gemma 3 4B' },
]

const getValidModel = (selectedModel: string | undefined) => {
  if (selectedModel && OLLAMA_MODELS.some(modelOption => modelOption.id === selectedModel)) {
    return selectedModel
  }
  return OLLAMA_MODELS[0].id
}

export function Main({ user, spaces, refreshData }: MainProps) {
  const [message, setMessage] = useState('')
  const [model, setModel] = useState(getValidModel(user.selected_model))
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    const messageToSend = message
    setMessage('')
    
    try {
      sessionStorage.setItem('new_chat_pending', JSON.stringify({
        message: messageToSend,
        model: model,
        spaceId: selectedSpace
      }))
      route('/chat/0')
    } catch (error) {
      console.error('Navigation error:', error)
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
    }
  }

  return (
    <div class="flex flex-col items-center justify-center min-h-[80vh] w-full mx-auto px-4 py-12">
      <div class="w-full max-w-2xl flex flex-col items-center gap-8">
        <h1 class="text-4xl font-light text-[var(--text-color)] tracking-tight mb-2">perplexicat</h1>
        
        <div class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-2xl p-3 shadow-lg relative z-10 transition-all">
          <div class="flex gap-2 mb-2 px-1">
            <select
              class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-xs text-[var(--text-color)] cursor-pointer outline-none hover:bg-[var(--hover-bg)] transition-colors min-w-[110px]"
              value={selectedSpace?.toString() || ''}
              onChange={(event) => {
                const value = (event.target as HTMLSelectElement).value
                setSelectedSpace(value === '' ? null : parseInt(value))
              }}
            >
              <option value="">No Space</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id.toString()}>
                  {space.name}
                </option>
              ))}
            </select>
            <select
              class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-xs text-[var(--text-color)] cursor-pointer outline-none hover:bg-[var(--hover-bg)] transition-colors min-w-[110px]"
              value={model}
              onChange={(event) => setModel((event.target as HTMLSelectElement).value)}
            >
              {OLLAMA_MODELS.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              ))}
            </select>
          </div>
          
          <div class="flex items-end gap-3 px-1">
            <div class="flex-1">
              <textarea
                ref={textareaRef}
                class="w-full bg-transparent border-none text-[var(--text-color)] text-base resize-none outline-none min-h-[40px] max-h-[300px] leading-relaxed font-inherit p-1 placeholder-[var(--muted-color)]/50"
                placeholder="Ask anything..."
                value={message}
                onInput={(event) => {
                  setMessage((event.target as HTMLTextAreaElement).value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                autoFocus
              />
            </div>
            <div class="flex items-center mb-1">
              <button
                class="w-9 h-9 rounded-lg bg-[var(--accent-color)] border-none flex items-center justify-center cursor-pointer transition-all text-white hover:opacity-90 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed shadow-sm"
                onClick={handleSubmit}
                disabled={!message.trim() || isSubmitting}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}