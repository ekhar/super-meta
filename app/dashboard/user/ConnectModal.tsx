import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DatabaseApiKeys } from "./DatabaseApiKeys"

interface ConnectModalProps {
  isOpen: boolean
  onClose: () => void
  databaseId: string
  projectUrl: string
}

export function ConnectModal({ isOpen, onClose, databaseId, projectUrl }: ConnectModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 mb-4 border-b">
          <DialogTitle>Connect to Database</DialogTitle>
        </DialogHeader>
        <div className="pr-2">
          <DatabaseApiKeys databaseId={databaseId} projectUrl={projectUrl} />
        </div>
      </DialogContent>
    </Dialog>
  )
} 