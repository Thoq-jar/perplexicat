import { useState, useEffect, useRef } from 'preact/hooks'
import { ArrowUp, ExternalLink } from 'lucide-preact'
import { marked } from 'marked'
import { getChat, streamChat } from '../api'
import type { User, Chat, Space, Message, SearchResult } from '../types'

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
  { id: 'gemma3:4b', name: 'Gemma 3 4B' },
]

const getValidModel = (selectedModel: string | undefined) => {
  if (selectedModel && OLLAMA_MODELS.some(model => model.id === selectedModel)) {
    return selectedModel
  }
  return OLLAMA_MODELS[0].id
}

export function ChatPage({ id, user, chats, setChats, spaces, refreshData }: ChatPageProps) {
  const [activeChatId, setActiveChatId] = useState(parseInt(id || '0'))
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [thinkingContent, setThinkingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [model, setModel] = useState(getValidModel(user.selected_model))
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamingContentRef = useRef<string>('')
  const thinkingContentRef = useRef<string>('')
  const streamingElementRef = useRef<HTMLDivElement>(null)
  const thinkingElementRef = useRef<HTMLDivElement>(null)
  const isStreamingRef = useRef<boolean>(false)
  const shouldAutoScroll = useRef<boolean>(true)

  useEffect(() => {
    setActiveChatId(parseInt(id || '0'))
  }, [id])

  const loadChat = async () => {
    try {
      const data = await getChat(activeChatId)
      if (data) {
        setChat(data.chat)
        setMessages(data.messages)
        setSelectedSpace(data.chat.space_id || null)
        if (data.chat.title && chats.find(existingChat => existingChat.id === data.chat.id)) {
          const updatedChats = chats.map(existingChat => 
            existingChat.id === data.chat.id ? { ...existingChat, title: data.chat.title } : existingChat
          )
          setChats(updatedChats)
        }
      }
      return data
    } catch (error) {
      console.error('Failed to load chat:', error)
      return null
    }
  }

  const scrollToBottom = (force: boolean = false) => {
    if (shouldAutoScroll.current || force) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }
  }
  
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
      const atBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScroll.current = atBottom
    }
  }

  const updateStreamingDOM = (content: string, isThinking: boolean = false) => {
    const elementRef = isThinking ? thinkingElementRef : streamingElementRef
    if (elementRef.current) {
      try {
        if (isThinking) {
          elementRef.current.textContent = content
        } else {
          const html = marked.parse(content) as string
          elementRef.current.innerHTML = html
        }
        scrollToBottom()
      } catch (error) {
        if (elementRef.current) {
          elementRef.current.textContent = content
          scrollToBottom()
        }
      }
    }
  }

  const createStreamCallbacks = (currentChatId: number) => ({
    onChatCreated: (newChatId: number) => {
      if (!currentChatId && newChatId) {
        window.history.pushState({}, '', `/chat/${newChatId}`)
        setActiveChatId(newChatId)
        refreshData()
      }
    },
    onStatus: (status: string) => {
      setStreamStatus(status)
    },
    onThinking: (thinkingChunk: string) => {
      thinkingContentRef.current += thinkingChunk
      updateStreamingDOM(thinkingContentRef.current, true)
      setThinkingContent(thinkingContentRef.current)
    },
    onChunk: (chunk: string) => {
      if (streamStatus === 'thinking') {
        setStreamStatus(null)
      }
      streamingContentRef.current += chunk
      updateStreamingDOM(streamingContentRef.current, false)
      setStreamingContent(streamingContentRef.current)
    },
    onComplete: async (response: { chatId: number; content: string; searchResults?: SearchResult[] }) => {
      streamingContentRef.current = ''
      thinkingContentRef.current = ''
      setStreamingContent('')
      setThinkingContent('')
      setStreamStatus(null)
      setIsStreaming(false)
      isStreamingRef.current = false
      
      if (streamingElementRef.current) {
        streamingElementRef.current.innerHTML = ''
      }
      if (thinkingElementRef.current) {
        thinkingElementRef.current.innerHTML = ''
      }
      
      const finalChatId = response.chatId || activeChatId
      if (finalChatId) {
          await getChat(finalChatId).then(data => {
              if (data) {
                  setChat(data.chat)
                  setMessages(data.messages)
              }
          })
          refreshData()
      }
    },
    onError: (errorMessage: string) => {
      streamingContentRef.current = ''
      thinkingContentRef.current = ''
      setIsStreaming(false)
      isStreamingRef.current = false
      setStreamingContent('')
      setThinkingContent('')
      setStreamStatus(null)
      alert(`Error: ${errorMessage}`)
    },
  })

  const startStreaming = (message: string, modelName: string, currentChatId: number, spaceId?: number | null) => {
    if (isStreamingRef.current) {
      return Promise.resolve()
    }
    
    streamingContentRef.current = ''
    thinkingContentRef.current = ''
    setIsStreaming(true)
    isStreamingRef.current = true
    setStreamingContent('')
    setThinkingContent('')
    setStreamStatus('thinking')
    
    shouldAutoScroll.current = true
    scrollToBottom(true)
    
    if (streamingElementRef.current) {
      streamingElementRef.current.innerHTML = ''
    }
    if (thinkingElementRef.current) {
      thinkingElementRef.current.innerHTML = ''
    }

    return streamChat(message, modelName, currentChatId, createStreamCallbacks(currentChatId), spaceId)
  }

  useEffect(() => {
    if (activeChatId) {
      const initializeChat = async () => {
        const chatData = await loadChat()
        shouldAutoScroll.current = true
        scrollToBottom(true)
        const pendingStreamKey = `pendingStream_${activeChatId}`
        const pendingStreamData = sessionStorage.getItem(pendingStreamKey)
        
        if (pendingStreamData) {
          try {
            const { message: pendingMessage, model: pendingModel } = JSON.parse(pendingStreamData)
            sessionStorage.removeItem(pendingStreamKey)
            
            const loadedMessages = chatData?.messages || []
            const hasAssistantResponse = loadedMessages.some((message: Message) => message.role === 'assistant')
            
            if (pendingMessage && pendingModel && !hasAssistantResponse && !isStreamingRef.current) {
              setModel(pendingModel)
              await startStreaming(pendingMessage, pendingModel, activeChatId)
            }
          } catch (error) {
            console.error('Failed to parse pending stream data:', error)
            sessionStorage.removeItem(pendingStreamKey)
          }
        }
      }
      initializeChat()
    } else {
        const pendingNewChatData = sessionStorage.getItem('new_chat_pending')
        if (pendingNewChatData) {
            try {
                const { message, model: newModel, spaceId } = JSON.parse(pendingNewChatData)
                sessionStorage.removeItem('new_chat_pending')
                
                if (message) {
                    setModel(newModel || model)
                    if (spaceId) setSelectedSpace(spaceId)
                    
                    const optimisticMessage: Message = {
                        id: Date.now(),
                        role: 'user',
                        content: message,
                        created_at: new Date().toISOString(),
                        chat_id: 0
                    }
                    setMessages([optimisticMessage])
                    
                    startStreaming(message, newModel || model, 0, spaceId)
                }
            } catch (error) {
                console.error('Failed to parse new chat pending data:', error)
            }
        } else {
            setMessages([])
            setChat(null)
        }
    }
  }, [activeChatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, thinkingContent, isStreaming, streamStatus])

  useEffect(() => {
    if (streamingElementRef.current && isStreaming && streamingContent) {
      const currentText = streamingElementRef.current.textContent || ''
      if (currentText !== streamingContent) {
        updateStreamingDOM(streamingContent, false)
      }
    } else if (streamingElementRef.current && isStreaming && !streamingContent) {
      streamingElementRef.current.innerHTML = ''
    }
  }, [streamingContent, isStreaming])

  const handleSubmit = async () => {
    if (!inputMessage.trim() || isStreaming || isStreamingRef.current) return

    const messageToSend = inputMessage.trim()
    setInputMessage('')

    const optimisticMessage: Message = {
        id: Date.now(),
        role: 'user',
        content: messageToSend,
        created_at: new Date().toISOString(),
        chat_id: activeChatId
    }
    setMessages(prev => [...prev, optimisticMessage])
    
    shouldAutoScroll.current = true
    scrollToBottom(true)

    try {
      await startStreaming(messageToSend, model, activeChatId, selectedSpace)
    } catch (error) {
      console.error('Stream error:', error)
      setIsStreaming(false)
      isStreamingRef.current = false
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 250)}px`
    }
  }

  const renderMarkdown = (content: string) => {
    try {
      return { __html: marked.parse(content) as string }
    } catch (error) {
      return { __html: content }
    }
  }

  const renderSearchResults = (results: SearchResult[] | undefined) => {
    if (!results || results.length === 0) return null
    
    return (
      <div class="flex flex-col gap-2 mb-4">
        {results.map((result, index) => (
          <div key={index} class="flex flex-col border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--accent-color)] transition-all">
            <a 
              href={result.url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="flex items-center gap-3 p-2.5 text-[var(--text-color)] hover:bg-[var(--hover-bg)] transition-colors no-underline group"
            >
              {result.favicon && (
                <img 
                  src={result.favicon} 
                  alt="" 
                  class="w-4 h-4 object-contain shrink-0 rounded" 
                  onError={(event) => { 
                    (event.target as HTMLImageElement).style.display = 'none' 
                  }} 
                />
              )}
              <div class="flex flex-col flex-1 min-w-0">
                <span class="font-bold text-xs text-[var(--text-color)] truncate">{result.title || 'Untitled'}</span>
                <span class="text-[10px] text-[var(--muted-color)] truncate opacity-60 font-mono tracking-tight">{result.url}</span>
              </div>
              <ExternalLink size={12} class="text-[var(--muted-color)] shrink-0 opacity-30 group-hover:opacity-100 transition-all" />
            </a>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div class="flex flex-col h-screen w-full max-w-3xl mx-auto">
      <div 
        class="flex-1 overflow-y-auto p-4 md:p-6 pb-32 flex flex-col gap-8 relative scroll-smooth [mask-image:linear-gradient(to_bottom,black_0%,black_85%,transparent_100%)]" 
        ref={chatContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((message) => (
          message.role === 'user' ? (
            <div key={message.id} class="text-xl font-medium leading-tight text-[var(--text-color)] max-w-2xl mx-auto w-full text-center py-2">
              {message.content}
            </div>
          ) : (
            <div key={message.id} class="w-full max-w-2xl mx-auto">
              {message.search_results && message.search_results.length > 0 && renderSearchResults(message.search_results)}
              {message.thinking && (
                <details class="mb-4 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)]/30 overflow-hidden group">
                  <summary class="px-4 py-2 cursor-pointer select-none flex items-center gap-2 text-[10px] font-bold text-[var(--muted-color)] list-none outline-none hover:bg-[var(--hover-bg)] transition-colors uppercase tracking-widest">
                    <span class="transform transition-transform duration-300 group-open:rotate-180 opacity-60">▼</span>
                    <span>Reasoning</span>
                  </summary>
                  <div class="p-4 border-t border-[var(--border-color)] text-[11px] leading-relaxed text-[var(--muted-color)] font-mono whitespace-pre-wrap break-words opacity-80 bg-[var(--bg-secondary)]/50">
                    {message.thinking}
                  </div>
                </details>
              )}
              <div
                class="markdown-content text-[var(--text-color)] text-sm leading-relaxed [&>p]:mb-4 [&>pre]:bg-[var(--bg-tertiary)] [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:my-4 [&>pre]:border [&>pre]:border-[var(--border-color)] [&>pre]:overflow-x-auto [&>code]:font-mono [&>code]:text-xs [&_:not(pre)>code]:bg-[var(--bg-tertiary)] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>blockquote]:border-l-4 [&>blockquote]:border-[var(--accent-color)] [&>blockquote]:pl-4 [&>blockquote]:my-4 [&>blockquote]:text-[var(--muted-color)] [&>blockquote]:italic [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-base [&>h2]:font-bold [&>h2]:mb-3 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:mb-2"
                dangerouslySetInnerHTML={renderMarkdown(message.content)}
              />
            </div>
          )
        ))}

        {isStreaming && (
          <div class="w-full max-w-2xl mx-auto">
            {thinkingContent && (
              <details class="mb-4 border border-[var(--border-color)] rounded-lg bg-[var(--bg-secondary)]/30 overflow-hidden group shadow-sm" open={isStreaming}>
                <summary class="px-4 py-2 cursor-pointer select-none flex items-center gap-2 text-[10px] font-bold text-[var(--muted-color)] list-none outline-none hover:bg-[var(--hover-bg)] transition-colors uppercase tracking-widest">
                  <span class="transform transition-transform duration-300 group-open:rotate-180 opacity-60">▼</span>
                  <span>Reasoning</span>
                </summary>
                <div
                  ref={thinkingElementRef}
                  class="p-4 border-t border-[var(--border-color)] text-[11px] leading-relaxed text-[var(--muted-color)] font-mono whitespace-pre-wrap break-words opacity-80 bg-[var(--bg-secondary)]/50"
                />
              </details>
            )}
            {streamingContent && (
              <div
                ref={streamingElementRef}
                class="markdown-content text-[var(--text-color)] text-sm leading-relaxed [&>p]:mb-4 [&>pre]:bg-[var(--bg-tertiary)] [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:my-4 [&>pre]:border [&>pre]:border-[var(--border-color)] [&>pre]:overflow-x-auto [&>code]:font-mono [&>code]:text-xs [&_:not(pre)>code]:bg-[var(--bg-tertiary)] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>blockquote]:border-l-4 [&>blockquote]:border-[var(--accent-color)] [&>blockquote]:pl-4 [&>blockquote]:my-4 [&>blockquote]:text-[var(--muted-color)] [&>blockquote]:italic [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-base [&>h2]:font-bold [&>h2]:mb-3 [&>h3]:text-sm [&>h3]:font-bold [&>h3]:mb-2"
              />
            )}
            {!streamingContent && !thinkingContent && (
              <div class="flex items-center gap-2 py-2 text-xs text-[var(--muted-color)] font-medium">
                <div class="w-3 h-3 border-2 border-[var(--muted-color)] border-t-transparent rounded-full animate-spin"></div>
                {streamStatus === 'searching' && 'Searching...'}
                {streamStatus === 'thinking' && 'Reasoning...'}
                {streamStatus && streamStatus !== 'searching' && streamStatus !== 'thinking' && `${streamStatus}...`}
                {!streamStatus && 'Working...'}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div class="p-4 relative flex justify-center items-center -mt-16 pt-20 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/98 to-transparent z-10">
        <div class="w-full max-w-2xl bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl p-2.5 shadow-xl relative z-20 transition-all">
          <div class="flex gap-2 mb-1.5 px-2">
            <select
              class="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-2 py-0.5 text-[10px] font-bold text-[var(--text-color)] cursor-pointer outline-none hover:bg-[var(--hover-bg)] transition-colors min-w-[100px] uppercase tracking-wider"
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
          <div class="flex items-end gap-2 px-2 pb-0.5">
            <div class="flex-1 relative">
              <textarea
                ref={textareaRef}
                class="w-full bg-transparent border-none text-[var(--text-color)] text-sm resize-none outline-none min-h-[32px] max-h-[300px] leading-relaxed font-inherit p-0.5 placeholder-[var(--muted-color)]/40"
                placeholder="Continue the conversation..."
                value={inputMessage}
                onInput={(event) => {
                  setInputMessage((event.target as HTMLTextAreaElement).value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                rows={1}
              />
            </div>
            <div class="flex items-center mb-0.5">
              <button
                class="w-8 h-8 rounded-lg bg-[var(--accent-color)] border-none flex items-center justify-center cursor-pointer transition-all text-white hover:opacity-90 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed shadow-sm"
                onClick={handleSubmit}
                disabled={!inputMessage.trim() || isStreaming || isStreamingRef.current}
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
