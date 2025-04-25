// This file contains all logic and UI related to the Contract Modal
// extracted from ProjectContract for cleaner separation

"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Edit,
  Trash2,
  PlusCircle,
  Loader2,
  Calendar,
  User,
  DollarSign,
  FileText,
  FileSignature,
  Clock,
} from "lucide-react"

export default function ContractsModal({
  isOpen,
  onClose,
  modalView,
  setModalView,
  selectedProject,
  contracts,
  setContracts,
  selectedContract,
  setSelectedContract,
  contractTypes,
  contractStatuses,
  signatories,
  authors,
  translators,
  rightsOwners,
  reviewers,
  contentTypes,
  getStatusColor,
  getStatusName,
  getStatusCode,
  getTypeColor,
  getTypeIcon,
  getTypeName,
  getSignatoryName,
  getContractedPartyName,
  getContractedPartyOptions,
  getContentTypeIdForContractType,
  getContractedPartyTypeFromContractType,
  isContractsLoading,
  isSubmitting,
  setIsSubmitting,
  formRef,
  handleSubmitContract,
  handleEditContract,
  handleDeleteContract,
  handleBackToList,
  handleCreateContract,
  contractToDelete,
  setContractToDelete,
  confirmDelete,
  deleteConfirmation,
  setDeleteConfirmation,
  selectedContractType,
  setSelectedContractType,
}: any) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {modalView !== "list" && (
              <Button variant="ghost" size="icon" className="mr-2 h-8 w-8" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selectedProject?.title_ar} {selectedProject?.title_original && (
              <span className="text-muted-foreground ml-2">
                ({selectedProject.title_original})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {modalView === "list" && "Manage contracts for this project"}
            {modalView === "create" && "Create a new contract"}
            {modalView === "edit" && "Edit contract details"}
          </DialogDescription>
        </DialogHeader>

        {/* CONTRACTS LIST */}
        {modalView === "list" && (
          <div className="py-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Project Contracts</h3>
              <Button onClick={handleCreateContract}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Contract
              </Button>
            </div>

            {isContractsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading contracts...</span>
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-8 border rounded-md bg-muted/30">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No contracts available</h3>
                <p className="text-muted-foreground">Add your first contract to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contracts.map((contract: any) => (
                  <div key={contract.id} className="relative border rounded-lg overflow-hidden transition-all hover:shadow-md">
                    <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(getStatusCode(contract.status_id)).split(" ")[0]}`}></div>
                    <div className="p-4 pl-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-lg font-medium">{contract.title || "Untitled Contract"}</h4>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditContract(contract)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteContract(contract)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center">
                            <User className="h-3 w-3 mr-1" /> Contracted Party
                          </p>
                          <p className="text-sm">{getContractedPartyName(contract)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" /> Start Date
                          </p>
                          <p className="text-sm">{contract.start_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" /> End Date
                          </p>
                          <p className="text-sm">{contract.end_date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center">
                            <User className="h-3 w-3 mr-1" /> Signed By
                          </p>
                          <p className="text-sm">{getSignatoryName(contract.signed_by_id, contract.signed_by)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusColor(getStatusCode(contract.status_id))}`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {getStatusName(contract.status_id)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getTypeColor(contract.contract_type_id)}`}>
                          {getTypeIcon(contract.contract_type_id)}
                          <span className="ml-1">{getTypeName(contract.contract_type_id)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DELETE CONFIRMATION */}
        {contractToDelete && (
          <Dialog open={true} onOpenChange={() => setContractToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Contract</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this contract? This action cannot be undone.
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Contract Details:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Title: {contractToDelete?.title || "Untitled"}</li>
                      <li>Type: {getTypeName(contractToDelete?.contract_type_id ?? null)}</li>
                      <li>Status: {getStatusName(contractToDelete?.status_id ?? null)}</li>
                    </ul>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Type DELETE to confirm:</p>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full"
                    />
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setContractToDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteConfirmation !== "DELETE"}
                >
                  Delete Contract
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* FORM COMPONENT SHOULD GO HERE if modalView is create or edit */}
        {modalView !== "list" && (
          <form ref={formRef} onSubmit={handleSubmitContract} className="py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Contract Title</Label>
                <Input id="title" name="title" defaultValue={selectedContract?.title || ""} placeholder="Enter contract title" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract_type_id">Contract Type</Label>
                <Select
                  name="contract_type_id"
                  defaultValue={selectedContract?.contract_type_id?.toString() || ""}
                  onValueChange={(value) => {
                    const newContractTypeId = Number.parseInt(value)
                    setSelectedContractType(newContractTypeId)
                    if (selectedContract) {
                      const newType = getContractedPartyTypeFromContractType(newContractTypeId)
                      setSelectedContract({
                        ...selectedContract,
                        contract_type_id: newContractTypeId,
                        contracted_party_type_value: newType || undefined,
                        contracted_party_id_value: undefined
                      })
                    }
                  }}
                  required
                >
                  <SelectTrigger id="contract_type_id">
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContractType && (
                <div className="space-y-2">
                  <Label htmlFor="contracted_party_id">Contracted Party</Label>
                  <Select
                    name="contracted_party_id"
                    defaultValue={selectedContract?.contracted_party_id_value?.toString() || ""}
                    required
                  >
                    <SelectTrigger id="contracted_party_id">
                      <SelectValue placeholder="Select contracted party" />
                    </SelectTrigger>
                    <SelectContent>
                      {getContractedPartyOptions(selectedContract?.contracted_party_type_value).map((party: any) => (
                        <SelectItem key={party.id} value={party.id.toString()}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="status_id">Status</Label>
                <Select
                  name="status_id"
                  defaultValue={selectedContract?.status_id?.toString() || ""}
                  required
                >
                  <SelectTrigger id="status_id">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.display_name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signed_by_id">Signed By</Label>
                <Select
                  name="signed_by_id"
                  defaultValue={selectedContract?.signed_by_id?.toString() || ""}
                  required
                >
                  <SelectTrigger id="signed_by_id">
                    <SelectValue placeholder="Select signatory" />
                  </SelectTrigger>
                  <SelectContent>
                    {signatories.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input id="start_date" name="start_date" type="date" defaultValue={selectedContract?.start_date || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input id="end_date" name="end_date" type="date" defaultValue={selectedContract?.end_date || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fixed_amount">Fixed Amount</Label>
                <Input id="fixed_amount" name="fixed_amount" type="number" step="0.01" defaultValue={selectedContract?.fixed_amount || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_percent">Commission %</Label>
                <Input id="commission_percent" name="commission_percent" type="number" step="0.01" defaultValue={selectedContract?.commission_percent || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="free_copies">Free Copies</Label>
                <Input id="free_copies" name="free_copies" type="number" defaultValue={selectedContract?.free_copies || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract_duration">Duration (months)</Label>
                <Input id="contract_duration" name="contract_duration" type="number" defaultValue={selectedContract?.contract_duration || ""} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="payment_schedule">Payment Schedule</Label>
                <Textarea id="payment_schedule" name="payment_schedule" defaultValue={selectedContract?.payment_schedule || ""} rows={3} required />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" defaultValue={selectedContract?.notes || ""} rows={3} />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleBackToList}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {modalView === "create" ? "Create Contract" : "Update Contract"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

