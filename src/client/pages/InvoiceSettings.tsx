import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useInvoiceClients, useInvoiceDescriptions } from '../hooks/useInvoices'
import { useSnackbar } from '../contexts/SnackbarContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button, ConfirmDialog, Spinner } from '@drillman/dashboard-ui'

const sectionTitleClass = "font-display text-kpi-sm font-semibold leading-tight tracking-[-0.015em] text-text-primary"
const inputClass =
  'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent'

export default function InvoiceSettings() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useSnackbar()

  const { data: clientsData, isLoading: isLoadingClients } = useInvoiceClients()
  const { data: descriptionsData, isLoading: isLoadingDescriptions } = useInvoiceDescriptions()

  const [newClient, setNewClient] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'client' | 'description'; value: string } | null>(null)

  const clients = clientsData?.clients || []
  const descriptions = descriptionsData?.descriptions || []

  const addClientMutation = useMutation({
    mutationFn: (client: string) => api.post<void>('/invoices/settings/clients', { client }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'clients'] })
      setNewClient('')
      showSuccess('Client ajouté avec succès')
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Erreur lors de l\'ajout')
    },
  })

  const deleteClientMutation = useMutation({
    mutationFn: (client: string) => api.delete<void>(`/invoices/settings/clients/${encodeURIComponent(client)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'clients'] })
      setDeleteConfirm(null)
      showSuccess('Client supprimé avec succès')
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Erreur lors de la suppression')
    },
  })

  const addDescriptionMutation = useMutation({
    mutationFn: (description: string) => api.post<void>('/invoices/settings/descriptions', { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'descriptions'] })
      setNewDescription('')
      showSuccess('Description ajoutée avec succès')
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Erreur lors de l\'ajout')
    },
  })

  const deleteDescriptionMutation = useMutation({
    mutationFn: (description: string) => api.delete<void>(`/invoices/settings/descriptions/${encodeURIComponent(description)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'descriptions'] })
      setDeleteConfirm(null)
      showSuccess('Description supprimée avec succès')
    },
    onError: (error) => {
      showError(error instanceof Error ? error.message : 'Erreur lors de la suppression')
    },
  })

  const handleAddClient = (e: FormEvent) => {
    e.preventDefault()
    if (newClient.trim()) {
      addClientMutation.mutate(newClient.trim())
    }
  }

  const handleAddDescription = (e: FormEvent) => {
    e.preventDefault()
    if (newDescription.trim()) {
      addDescriptionMutation.mutate(newDescription.trim())
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.type === 'client') {
      deleteClientMutation.mutate(deleteConfirm.value)
    } else {
      deleteDescriptionMutation.mutate(deleteConfirm.value)
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-display text-kpi-lg font-bold leading-tight tracking-[-0.02em] text-text-primary">
          Paramètres des factures
        </h1>
        <p className="text-sm text-text-secondary">
          Gérez les valeurs suggérées pour accélérer la création de vos factures.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-card border border-border bg-surface p-6 ">
          <div className="space-y-1">
            <h2 className={sectionTitleClass}>Clients</h2>
            <p className="text-sm text-text-secondary">
              Liste des clients pour l'autocomplétion lors de la création de factures.
            </p>
          </div>

          <form onSubmit={handleAddClient} className="mt-5 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="new-client" className="text-xs font-medium text-text-secondary">
                Nouveau client
              </label>
              <input
                id="new-client"
                type="text"
                className={inputClass}
                placeholder="Ex: SARL Martin Conseil"
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!newClient.trim() || addClientMutation.isPending}
              startIcon={addClientMutation.isPending ? undefined : <Plus className="h-4 w-4" />}
            >
              {addClientMutation.isPending ? <Spinner size="sm" /> : 'Ajouter'}
            </Button>
          </form>

          {isLoadingClients ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : clients.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">Aucun client enregistré</p>
          ) : (
            <ul className="mt-5 space-y-2">
              {clients.map((client) => (
                <li
                  key={client}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-text-primary">{client}</span>
                  <Button
                    variant="ghost"
                    size="sm" iconOnly
                    onClick={() => setDeleteConfirm({ type: 'client', value: client })}
                    title="Supprimer ce client"
                    className="h-8 w-8 text-danger hover:bg-danger-soft hover:text-danger-strong"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-border bg-surface p-6 ">
          <div className="space-y-1">
            <h2 className={sectionTitleClass}>Descriptions</h2>
            <p className="text-sm text-text-secondary">
              Liste des descriptions prédéfinies pour les factures.
            </p>
          </div>

          <form onSubmit={handleAddDescription} className="mt-5 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="new-description" className="text-xs font-medium text-text-secondary">
                Nouvelle description
              </label>
              <input
                id="new-description"
                type="text"
                className={inputClass}
                placeholder="Ex: Développement et maintenance"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!newDescription.trim() || addDescriptionMutation.isPending}
              startIcon={addDescriptionMutation.isPending ? undefined : <Plus className="h-4 w-4" />}
            >
              {addDescriptionMutation.isPending ? <Spinner size="sm" /> : 'Ajouter'}
            </Button>
          </form>

          {isLoadingDescriptions ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : descriptions.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">Aucune description enregistrée</p>
          ) : (
            <ul className="mt-5 space-y-2">
              {descriptions.map((description) => (
                <li
                  key={description}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate pr-2 text-sm text-text-primary">{description}</span>
                  <Button
                    variant="ghost"
                    size="sm" iconOnly
                    onClick={() => setDeleteConfirm({ type: 'description', value: description })}
                    title="Supprimer cette description"
                    className="h-8 w-8 text-danger hover:bg-danger-soft hover:text-danger-strong"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={deleteConfirm?.type === 'client' ? 'Supprimer le client' : 'Supprimer la description'}
        message={
          deleteConfirm
            ? `Êtes-vous sûr de vouloir supprimer "${deleteConfirm.value}" ? Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        tone="danger"
        loading={deleteClientMutation.isPending || deleteDescriptionMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
