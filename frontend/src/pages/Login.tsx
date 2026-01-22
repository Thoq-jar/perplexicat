import { useState } from 'preact/hooks'
import { login } from '../api'

interface LoginProps {
  path?: string
  default?: boolean
}

export function Login(_props: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(username, password)
      if (result.success) {
        window.location.href = '/'
      } else {
        setError(result.message || 'Login failed')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div class="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--bg-color)]">
      <h1 class="text-4xl font-light mb-8 text-[var(--text-color)] tracking-tight">perplexicat</h1>
      <div class="w-full max-w-sm bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl p-8 shadow-sm">
        <h2 class="text-xl font-medium mb-6 text-[var(--text-color)]">Login</h2>
        <form onSubmit={handleSubmit}>
          <div class="mb-4">
            <input
              type="text"
              class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--bg-secondary)] transition-all text-[var(--text-color)] placeholder-[var(--muted-color)]"
              placeholder="Username"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <div class="mb-4">
            <input
              type="password"
              class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[var(--accent-color)] focus:bg-[var(--bg-secondary)] transition-all text-[var(--text-color)] placeholder-[var(--muted-color)]"
              placeholder="Password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <button 
            type="submit" 
            class="w-full py-3.5 bg-[var(--accent-color)] text-white rounded-xl font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <div class="mt-4 p-3 bg-[var(--danger-color)] text-white rounded-xl text-sm font-medium text-center">{error}</div>}
        <p class="text-center mt-6 text-sm text-[var(--muted-color)]">
          Don't have an account? <a href="/register" class="text-[var(--accent-color)] hover:underline">Register</a>
        </p>
      </div>
    </div>
  )
}