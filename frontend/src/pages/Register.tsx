import { useState } from 'preact/hooks'
import { register } from '../api'

interface RegisterProps {
  path?: string
}

export function Register(_props: RegisterProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await register(username, password)
      if (result.success) {
        window.location.href = '/'
      } else {
        setError(result.message || 'Registration failed')
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
        <h2>Register</h2>
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
              onInput={(event) => setPassword((event.target as HTMLInputElement).value)}
              required
            />
          </div>
          <button type="submit" class="auth-btn" disabled={isLoading}>
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        {error && <div class="flash">{error}</div>}
        <p class="auth-footer">
          Already have an account? <a href="/">Login</a>
        </p>
      </div>
    </div>
  )
}
