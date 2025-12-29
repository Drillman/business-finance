import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useInvoiceClients, useInvoiceDescriptions } from '../hooks/useInvoices'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface InvoiceSettingsData {
  clients: string[]
  descriptions: string[]
}

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

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault()
    if (newClient.trim()) {
      addClientMutation.mutate(newClient.trim())
    }
  }

  const handleAddDescription = (e: React.FormEvent) => {
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
    <div>
      <h1 className="text-2xl font-bold mb-6">Paramètres des factures</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clients List */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Clients</h2>
            <p className="text-base-content/60 text-sm mb-4">
              Liste des clients pour l'autocomplétion lors de la création de factures.
            </p>

            <form onSubmit={handleAddClient} className="flex gap-2 mb-4">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="Nouveau client..."
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-square"
                disabled={!newClient.trim() || addClientMutation.isPending}
              >
                {addClientMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
            </form>

            {isLoadingClients ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : clients.length === 0 ? (
              <p className="text-base-content/50 text-center py-4">Aucun client enregistré</p>
            ) : (
              <ul className="space-y-2">
                {clients.map((client) => (
                  <li
                    key={client}
                    className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                  >
                    <span>{client}</span>
                    <button
                      className="btn btn-ghost btn-sm btn-square text-error"
                      onClick={() => setDeleteConfirm({ type: 'client', value: client })}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Descriptions List */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Descriptions</h2>
            <p className="text-base-content/60 text-sm mb-4">
              Liste des descriptions prédéfinies pour les factures.
            </p>

            <form onSubmit={handleAddDescription} className="flex gap-2 mb-4">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="Nouvelle description..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-square"
                disabled={!newDescription.trim() || addDescriptionMutation.isPending}
              >
                {addDescriptionMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
            </form>

            {isLoadingDescriptions ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : descriptions.length === 0 ? (
              <p className="text-base-content/50 text-center py-4">Aucune description enregistrée</p>
            ) : (
              <ul className="space-y-2">
                {descriptions.map((description) => (
                  <li
                    key={description}
                    className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                  >
                    <span className="truncate flex-1 mr-2">{description}</span>
                    <button
                      className="btn btn-ghost btn-sm btn-square text-error flex-shrink-0"
                      onClick={() => setDeleteConfirm({ type: 'description', value: description })}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm?.type === 'client' ? 'Supprimer le client' : 'Supprimer la description'}
        message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm?.value}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        isLoading={deleteClientMutation.isPending || deleteDescriptionMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
