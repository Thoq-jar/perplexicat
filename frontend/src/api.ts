import type { User, Chat, Space, Message } from './types'

const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        credentials: 'include',
    })
    if(!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
}

export async function login(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
        credentials: 'include',
    })
    const data = await response.json()
    return {success: data.success, message: data.message}
}

export async function register(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
        credentials: 'include',
    })
    const data = await response.json()
    return {success: data.success, message: data.message}
}

export async function logout(): Promise<{ success: boolean; message?: string }> {
    const response = await fetch('/auth/logout', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
    })
    const data = await response.json()
    return {success: data.success, message: data.message}
}

export async function getCurrentUser(): Promise<User | null> {
    try {
        return await request<User>(`${API_BASE}/user`)
    } catch {
        return null
    }
}

export async function getChats(): Promise<Chat[]> {
    return request<Chat[]>(`${API_BASE}/chats`)
}

export async function getChat(chatId: number): Promise<{ chat: Chat; messages: Message[] }> {
    return request<{ chat: Chat; messages: Message[] }>(`${API_BASE}/chat/${chatId}`)
}

export async function deleteChat(chatId: number): Promise<void> {
    await request(`${API_BASE}/delete_chat/${chatId}`, {method: 'DELETE'})
}

export async function deleteAllChats(): Promise<void> {
    await request(`${API_BASE}/delete_all_chats`, {method: 'DELETE'})
}

export async function updateChatTitle(chatId: number, title: string): Promise<void> {
    await request(`${API_BASE}/update_chat_title/${chatId}`, {
        method: 'POST',
        body: JSON.stringify({title}),
    })
}

export async function moveChatToSpace(chatId: number, spaceId: number | null): Promise<void> {
    await request(`${API_BASE}/move_chat_to_space`, {
        method: 'POST',
        body: JSON.stringify({chat_id: chatId, space_id: spaceId}),
    })
}

export async function getSpaces(): Promise<Space[]> {
    return request<Space[]>(`${API_BASE}/spaces`)
}

export async function getSpace(spaceId: number): Promise<{ space: Space; chats: Chat[] }> {
    return request<{ space: Space; chats: Chat[] }>(`${API_BASE}/space/${spaceId}`)
}

export async function createSpace(name: string): Promise<Space> {
    return request<Space>(`${API_BASE}/create_space`, {
        method: 'POST',
        body: JSON.stringify({name}),
    })
}

export async function deleteSpace(spaceId: number): Promise<void> {
    await request(`${API_BASE}/delete_space/${spaceId}`, {method: 'DELETE'})
}

export async function updateTheme(theme: string): Promise<void> {
    await request(`${API_BASE}/update_theme`, {
        method: 'POST',
        body: JSON.stringify({theme}),
    })
}

export async function updateModel(model: string): Promise<void> {
    await request(`${API_BASE}/update_model`, {
        method: 'POST',
        body: JSON.stringify({model}),
    })
}

export interface StreamCallbacks {
    onChatCreated?: (chatId: number) => void
    onChunk?: (chunk: string) => void
    onComplete?: (response: { chatId: number; content: string }) => void
    onError?: (error: string) => void
}

export async function streamChat(
    message: string,
    model: string,
    chatId?: number,
    callbacks?: StreamCallbacks
): Promise<void> {
    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({
            query: message,
            model: model,
            chat_id: chatId,
            is_followup: !!chatId,
            use_sse: true,
        }),
    })

    if(!response.ok) {
        callbacks?.onError?.('Failed to start chat')
        return
    }

    const reader = response.body?.getReader()
    if(!reader) {
        callbacks?.onError?.('No response body')
        return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while(true) {
        const {done, value} = await reader.read()
        if(done) break

        buffer += decoder.decode(value, {stream: true})
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for(const line of lines) {
            if(line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6))
                    if(data.type === 'chat_created') {
                        callbacks?.onChatCreated?.(data.chat_id)
                    } else if(data.type === 'chunk') {
                        fullContent += data.chunk
                        callbacks?.onChunk?.(data.chunk)
                    } else if(data.type === 'complete') {
                        callbacks?.onComplete?.({chatId: data.chat_id, content: fullContent})
                    } else if(data.type === 'error') {
                        callbacks?.onError?.(data.message)
                    }
                } catch {
                    // ignore :3
                }
            }
        }
    }
}
