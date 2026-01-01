import { useState } from 'react'
import { usePasskeys, useDeletePasskey, useRenamePasskey } from '../hooks/useAuth'
import { registerPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'

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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!supportsPasskey) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Gérer les Passkeys</h1>
        <div className="alert alert-warning">
          Votre navigateur ne supporte pas les passkeys.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gérer les Passkeys</h1>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-4">
          <span>{success}</span>
        </div>
      )}

      {/* Register new passkey */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="card-title text-lg">Ajouter un nouveau Passkey</h2>
          <p className="text-base-content/70">
            Enregistrez un nouveau passkey pour vous connecter sans mot de passe.
          </p>
          <div className="flex gap-4 mt-4">
            <input
              type="text"
              placeholder="Nom de l'appareil (ex: MacBook Pro)"
              className="input input-bordered flex-1"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleRegisterPasskey}
              disabled={isRegistering}
            >
              {isRegistering ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                'Ajouter'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* List of passkeys */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-lg">Passkeys enregistrés</h2>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : !passkeys || passkeys.length === 0 ? (
            <p className="text-base-content/70 py-4">Aucun passkey enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Appareil</th>
                    <th>Créé le</th>
                    <th>Dernière utilisation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passkeys.map((passkey) => (
                    <tr key={passkey.id}>
                      <td>
                        {editingId === passkey.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="input input-bordered input-sm"
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
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => startEditing(passkey.id, passkey.deviceName)}
                          >
                            {passkey.deviceName || 'Passkey'}
                          </span>
                        )}
                      </td>
                      <td>{formatDate(passkey.createdAt)}</td>
                      <td>
                        {passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : 'Jamais'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() => handleDelete(passkey.id)}
                          disabled={deletePasskeyMutation.isPending}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
