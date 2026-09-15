import { useState } from 'react'
import { usePasskeys, useDeletePasskey, useRenamePasskey } from '../hooks/useAuth'
import { registerPasskey, isPasskeySupported } from '../utils/passkey'
import { useQueryClient } from '@tanstack/react-query'
import { Fingerprint, KeyRound, Pencil, Trash2, X } from 'lucide-react'
import { Alert, Badge, Button, Card, DataTable, Input, Spinner, type DataTableColumn } from '@drillman/dashboard-ui'

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
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Gestion des Passkeys
        </h1>
        <Alert tone="warning">Votre navigateur ne supporte pas les passkeys.</Alert>
      </div>
    )
  }

  type Passkey = NonNullable<typeof passkeys>[number]

  const passkeyColumns: DataTableColumn<Passkey>[] = [
    {
      key: 'name',
      header: "Nom de l'appareil",
      cell: (passkey) =>
        editingId === passkey.id ? (
          <div className="flex items-center gap-1">
            <Input
              size="sm"
              aria-label="Nom de l'appareil"
              containerClassName="flex-1"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(passkey.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={() => handleRename(passkey.id)}>
              OK
            </Button>
            <Button variant="ghost" size="sm" iconOnly aria-label="Annuler" onClick={() => setEditingId(null)}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="shrink-0 text-accent" />
            <span>{passkey.deviceName || 'Passkey'}</span>
          </div>
        ),
    },
    {
      key: 'created',
      header: 'Créé le',
      align: 'center',
      width: 'w-36',
      className: 'text-text-secondary',
      cell: (passkey) => formatDate(passkey.createdAt),
    },
    {
      key: 'last-used',
      header: 'Dernière utilisation',
      align: 'center',
      width: 'w-44',
      className: 'text-text-secondary',
      cell: (passkey) =>
        passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : <span className="italic text-text-muted">Jamais</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: 'w-24',
      cell: (passkey) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className="size-7 text-accent"
            onClick={() => startEditing(passkey.id, passkey.deviceName)}
            title="Renommer"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className="size-7 text-danger"
            onClick={() => handleDelete(passkey.id)}
            disabled={deletePasskeyMutation.isPending}
            title="Supprimer"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          Gestion des Passkeys
        </h1>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {/* Register new passkey */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-text-primary">
            Enregistrer un nouveau Passkey
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Ajoutez un passkey pour vous connecter sans mot de passe.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <Input
            label="Nom de l'appareil (optionnel)"
            containerClassName="flex-1"
            placeholder="Ex: MacBook Pro, iPhone 15..."
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRegisterPasskey()
            }}
          />
          <Button
            onClick={handleRegisterPasskey}
            loading={isRegistering}
            startIcon={<Fingerprint className="size-4" />}
          >
            Enregistrer
          </Button>
        </div>
      </Card>

      {/* Passkeys table */}
      <Card padding="none" className="overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-base font-semibold text-text-primary">
            Passkeys enregistrés
          </h2>
          {!isLoading && passkeys && passkeys.length > 0 && (
            <Badge tone="accent" size="md">
              {passkeys.length} passkey{passkeys.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-accent">
            <Spinner size="lg" />
          </div>
        ) : !passkeys || passkeys.length === 0 ? (
          <p className="px-6 py-8 text-sm text-text-secondary">
            Aucun passkey enregistré.
          </p>
        ) : (
          <DataTable
            variant="plain"
            columns={passkeyColumns}
            rows={passkeys}
            getRowKey={(passkey) => passkey.id}
          />
        )}
      </Card>

      {/* Info tip */}
      <Alert tone="info">
        Les passkeys vous permettent de vous connecter de manière sécurisée sans mot de passe, en utilisant la biométrie de votre appareil.
      </Alert>
    </div>
  )
}
