import { useState } from 'react'
import { usePasskeys, useDeletePasskey, useRenamePasskey } from '../hooks/useAuth'
import { registerPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { Fingerprint, KeyRound, Pencil, Trash2, Info } from 'lucide-react'

export default function ManagePasskeys() {
  const { data: passkeys, isLoading } = usePasskeys()
  const deletePasskeyMutation = useDeletePasskey()
  const renamePasskeyMutation = useRenamePasskey()
  const queryClient = useQueryClient()

  const [isRegistering, setIsRegistering] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supportsPasskey = isPasskeySupported()

  const handleRegisterPasskey = async () => {
    setError('')
    setSuccess('')
    setIsRegistering(true)

    try {
      await registerPasskey(newDeviceName || undefined)
      setNewDeviceName('')
      setSuccess('Passkey enregistré avec succès')
      queryClient.invalidateQueries({ queryKey: ['passkeys'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement du passkey")
    } finally {
      setIsRegistering(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError('')
    setSuccess('')

    deletePasskeyMutation.mutate(id, {
      onSuccess: () => {
        setSuccess('Passkey supprimé')
      },
      onError: (err) => {
        setError(err.message)
      },
    })
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return

    renamePasskeyMutation.mutate(
      { id, deviceName: editName.trim() },
      {
        onSuccess: () => {
          setEditingId(null)
          setEditName('')
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  const startEditing = (id: string, currentName: string | null) => {
    setEditingId(id)
    setEditName(currentName || '')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (!supportsPasskey) {
    return (
      <div className="flex flex-col gap-6 p-10">
        <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-base-content">
          Gestion des Passkeys
        </h1>
        <div className="alert alert-warning">
          Votre navigateur ne supporte pas les passkeys.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-['Space_Grotesk'] text-2xl font-semibold text-base-content">
          Gestion des Passkeys
        </h1>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
        </div>
      )}

      {/* Register new passkey */}
      <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 p-5">
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-base-content">
            Enregistrer un nouveau Passkey
          </h2>
          <p className="text-sm text-base-content/60">
            Ajoutez un passkey pour vous connecter sans mot de passe.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-base-content/60">
                Nom de l'appareil (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: MacBook Pro, iPhone 15..."
                className="input input-bordered rounded-lg h-10 text-sm"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRegisterPasskey()
                }}
              />
            </div>
            <button
              className="btn btn-primary gap-2"
              onClick={handleRegisterPasskey}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <Fingerprint size={16} />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* Passkeys table */}
      <div className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {/* Table header */}
        <div className="border-b border-(--border-default) px-6 py-4 flex items-center justify-between">
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-base-content">
            Passkeys enregistrés
          </h2>
          {!isLoading && passkeys && passkeys.length > 0 && (
            <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
              {passkeys.length} passkey{passkeys.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !passkeys || passkeys.length === 0 ? (
          <p className="text-sm text-base-content/60 px-6 py-8">
            Aucun passkey enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200) text-xs font-semibold tracking-wide uppercase text-base-content/50">
                  <th className="px-6 font-semibold text-left">Nom de l'appareil</th>
                  <th className="w-35 font-semibold text-center">Créé le</th>
                  <th className="w-45 font-semibold text-center">Dernière utilisation</th>
                  <th className="w-20 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {passkeys.map((passkey, i) => (
                  <tr
                    key={passkey.id}
                    className={`h-12 border-b border-(--border-default) ${i % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)'}`}
                  >
                    <td className="px-6">
                      {editingId === passkey.id ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="input input-bordered input-sm rounded-lg"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(passkey.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                          />
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleRename(passkey.id)}
                          >
                            OK
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setEditingId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <KeyRound size={16} className="text-primary shrink-0" />
                          <span className="text-sm text-base-content">
                            {passkey.deviceName || 'Passkey'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="w-35 text-center text-sm text-base-content/70">
                      {formatDate(passkey.createdAt)}
                    </td>
                    <td className="w-45 text-center text-sm text-base-content/70">
                      {passkey.lastUsedAt ? (
                        formatDate(passkey.lastUsedAt)
                      ) : (
                        <span className="italic text-base-content/40">Jamais</span>
                      )}
                    </td>
                    <td className="w-20">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          className="text-primary hover:opacity-70 transition-opacity"
                          onClick={() => startEditing(passkey.id, passkey.deviceName)}
                          title="Renommer"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="text-error hover:opacity-70 transition-opacity"
                          onClick={() => handleDelete(passkey.id)}
                          disabled={deletePasskeyMutation.isPending}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info tip */}
      <div className="flex items-center gap-2 bg-info/10 rounded-lg px-4 py-3">
        <Info size={16} className="text-info shrink-0" />
        <p className="text-sm text-info">
          Les passkeys vous permettent de vous connecter de manière sécurisée sans mot de passe, en utilisant la biométrie de votre appareil.
        </p>
      </div>
    </div>
  )
}
