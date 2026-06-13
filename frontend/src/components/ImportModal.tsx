import { useTranslation } from 'react-i18next'
import { useIsMobile } from '../hooks/useIsMobile'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  description?: string
  children: React.ReactNode
}

export function ImportModal({ open, onOpenChange, description, children }: ImportModalProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible>
        <DrawerContent className="rounded-t-2xl flex flex-col max-h-[80dvh]">
          <DrawerHeader className="pb-2 shrink-0">
            <DrawerTitle className="text-base font-semibold">{t('importModal.title')}</DrawerTitle>
            <DrawerDescription className="sr-only">{description ?? t('importModal.title')}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-auto flex-1 overscroll-contain">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('importModal.title')}</DialogTitle>
          <DialogDescription className="sr-only">{description ?? t('importModal.title')}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
