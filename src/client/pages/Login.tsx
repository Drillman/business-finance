import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useLogin } from '../hooks/useAuth'
import { loginWithPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { XCircle, Fingerprint, EyeOff, ShieldCheck, Receipt, TrendingUp } from 'lucide-react'

export default function Login() {
  const logoUrl = '/logo.svg'
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
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen w-full lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-linear-225 from-[#1E3A8A] via-[#3B82F6] to-[#6366F1] px-15 pb-14.5 pt-17.5 text-white lg:block">
          <div className="absolute -top-12.5 left-105 h-75 w-75 rounded-full bg-white/10" />
          <div className="absolute -left-10 top-50 h-45 w-45 rounded-full bg-white/8" />
          <div className="absolute left-125 top-125 h-30 w-30 rounded-full bg-white/12" />

          <div className="absolute left-15 top-45 flex h-16 w-60 -rotate-2 items-center gap-3 rounded-[14px] border border-white/20 bg-white/10 px-4 backdrop-blur-md">
            <TrendingUp className="h-6 w-6 text-[#6EE7B7]" />
            <div>
              <p className="text-[11px] font-medium text-white/70">Chiffre d'affaires</p>
              <p className="text-xl font-bold text-white">+12.4%</p>
            </div>
          </div>

          <div className="absolute left-95 top-80 flex h-16 w-55 rotate-3 items-center gap-3 rounded-[14px] border border-white/20 bg-white/10 px-4 backdrop-blur-md">
            <Receipt className="h-6 w-6 text-[#93C5FD]" />
            <div>
              <p className="text-[11px] font-medium text-white/70">Factures</p>
              <p className="text-lg font-bold text-white">24 ce mois</p>
            </div>
          </div>

          <div className="absolute left-35 top-115 flex h-16 w-50 -rotate-1 items-center gap-3 rounded-[14px] border border-white/20 bg-white/10 px-4 backdrop-blur-md">
            <ShieldCheck className="h-6 w-6 text-[#FCD34D]" />
            <div>
              <p className="text-[11px] font-medium text-white/70">TVA declaree</p>
              <p className="text-lg font-bold text-white">A jour</p>
            </div>
          </div>

          <div className="absolute bottom-40 left-15">
            <h2 className="max-w-md whitespace-pre-line text-5xl leading-[1.2] font-bold text-white">
              {'Gerez vos finances\nen toute simplicite.'}
            </h2>
            <p className="mt-5 max-w-lg text-base text-white/80">
              Factures, depenses, TVA, Urssaf - tout au meme endroit.
            </p>
          </div>

          <div className="absolute bottom-15 left-15 flex items-center gap-2.5">
            <img src={logoUrl} alt="Logo Finances" className="h-10 w-10 opacity-90" />
            <p className="text-[22px] font-bold text-white">Finances</p>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 sm:px-8">
          <div className="w-full max-w-95 space-y-6 py-8">
            <div className="flex items-center justify-center gap-3">
              <img src={logoUrl} alt="Logo Finances" className="h-10 w-10" />
              <p className="text-2xl font-bold text-[#18181B]">Finances</p>
            </div>

            <p className="text-center text-sm text-[#71717A]">Connectez-vous a votre compte</p>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#18181B]">Adresse e-mail</label>
                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  className="input input-bordered h-10.5 w-full rounded-lg border-[#E2E5F0] bg-white px-3 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#18181B]">Mot de passe</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="input input-bordered h-10.5 w-full rounded-lg border-[#E2E5F0] bg-white px-3 pr-10 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <EyeOff className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#A1A1AA]" />
                </div>
              </div>

              <button
                type="submit"
                className="btn h-9.5 w-full rounded-lg border-none bg-[#2563EB] text-sm font-medium text-white hover:bg-[#1D4ED8]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {supportsPasskey && (
              <>
                <div className="flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-[#E2E5F0]" />
                  <span className="text-[13px] text-[#A1A1AA]">ou</span>
                  <div className="h-px flex-1 bg-[#E2E5F0]" />
                </div>

                <button
                  type="button"
                  className="btn h-9.5 w-full gap-2 rounded-lg border-[1.5px] border-[#E2E5F0] bg-white text-sm font-medium text-[#18181B] hover:bg-[#F4F4F5]"
                  onClick={handlePasskeyLogin}
                  disabled={isPasskeyLoading}
                >
                  {isPasskeyLoading ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <>
                      <Fingerprint className="h-4.5 w-4.5" />
                      Se connecter avec une Passkey
                    </>
                  )}
                </button>
              </>
            )}

            <div className="pt-1 text-center text-sm text-[#71717A]">
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                S'inscrire
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
