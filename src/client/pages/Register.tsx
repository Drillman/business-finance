import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useRegister } from '../hooks/useAuth'
import { signupWithPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { Fingerprint } from 'lucide-react'
import { Alert, Button, Card, Input } from '@drillman/dashboard-ui'

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
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <Card padding="lg" className="w-full max-w-md">
        <h2 className="mb-6 text-center font-display text-2xl font-semibold tracking-tight text-text-primary">
          Créer un compte
        </h2>

        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="email@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            hint="Minimum 8 caractères"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" fullWidth loading={registerMutation.isPending} className="mt-2">
            S'inscrire
          </Button>
        </form>

        {supportsPasskey && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-text-muted">
              <div className="h-px flex-1 bg-border" />
              ou
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={handlePasskeySignup}
              loading={isPasskeyLoading}
              startIcon={<Fingerprint className="size-4" />}
            >
              S'inscrire avec Passkey
            </Button>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Inscription sans mot de passe avec votre appareil
            </p>
          </>
        )}

        <p className="mt-5 text-center text-sm text-text-secondary">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  )
}
