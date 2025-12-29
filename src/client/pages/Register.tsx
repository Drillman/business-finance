import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useRegister } from '../hooks/useAuth'
import { signupWithPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { XCircle, Fingerprint } from 'lucide-react'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const registerMutation = useRegister()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    registerMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          navigate('/', { replace: true })
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  const handlePasskeySignup = async () => {
    if (!email) {
      setError('Veuillez entrer votre email')
      return
    }

    setError('')
    setIsPasskeyLoading(true)

    try {
      const result = await signupWithPasskey(email)
      queryClient.setQueryData(['user'], result.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création du compte avec Passkey')
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const supportsPasskey = isPasskeySupported()

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-4">Créer un compte</h2>

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
                autoComplete="new-password"
              />
              <label className="label">
                <span className="label-text-alt">Minimum 8 caractères</span>
              </label>
            </div>

            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Confirmer le mot de passe</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-control mt-6">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "S'inscrire"
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
                onClick={handlePasskeySignup}
                disabled={isPasskeyLoading}
              >
                {isPasskeyLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Fingerprint className="h-5 w-5" />
                    S'inscrire avec Passkey
                  </>
                )}
              </button>
              <p className="text-sm text-base-content/70 text-center mt-2">
                Inscription sans mot de passe avec votre appareil
              </p>
            </>
          )}

          <div className="text-center mt-4">
            <span className="text-sm text-base-content/70">
              Déjà un compte ?{' '}
              <Link to="/login" className="link link-primary">
                Se connecter
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
