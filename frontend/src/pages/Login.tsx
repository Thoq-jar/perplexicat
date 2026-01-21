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
    <div class="container">
      <h1 class="title">Perplexicat</h1>
      <div class="auth-container">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <input
              type="text"
              class="input-component"
              placeholder="Username"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <div class="form-group">
            <input
              type="password"
              class="input-component"
              placeholder="Password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <button type="submit" class="auth-btn" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <div class="flash">{error}</div>}
        <p class="auth-footer">
          Don't have an account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  )
}
