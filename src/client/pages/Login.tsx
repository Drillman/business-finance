import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useLogin } from '../hooks/useAuth'
import { loginWithPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { XCircle, Fingerprint } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const loginMutation = useLogin()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          navigate(from, { replace: true })
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  const handlePasskeyLogin = async () => {
    setError('')
    setIsPasskeyLoading(true)

    try {
      const result = await loginWithPasskey(email || undefined)
      queryClient.setQueryData(['user'], result.user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion avec Passkey')
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const supportsPasskey = isPasskeySupported()

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-4">Connexion</h2>

          {error && (
            <div className="alert alert-error mb-4">
              <XCircle className="h-6 w-6 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="email@exemple.com"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Mot de passe</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </div>
          </form>

          {supportsPasskey && (
            <>
              <div className="divider">ou</div>

              <button
                type="button"
                className="btn btn-outline gap-2"
                onClick={handlePasskeyLogin}
                disabled={isPasskeyLoading}
              >
                {isPasskeyLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Fingerprint className="h-5 w-5" />
                    Connexion avec Passkey
                  </>
                )}
              </button>
            </>
          )}

          <div className="text-center mt-4">
            <span className="text-sm text-base-content/70">
              Pas encore de compte ?{' '}
              <Link to="/register" className="link link-primary">
                S'inscrire
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
