import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import type { Item } from '../api'

interface Props {
  open: boolean
  items: Item[]
  onClose: () => void
  onEdit: (item: Item) => void
}

export default function IncompleteItemsSheet({ open, items, onClose, onEdit }: Props) {
  const { t } = useTranslation()
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      disablePreventScroll
    >
      <DrawerContent
        className="flex flex-col max-h-[80dvh]"
      >
        <DrawerHeader className="text-left pb-3">
          <DrawerTitle>{t('incompleteItems.title')}</DrawerTitle>
          <DrawerDescription>
            {t('incompleteItems.description')}
          </DrawerDescription>
        </DrawerHeader>

        <Separator />

        <div className="overflow-auto flex-1 overscroll-contain">
          {items.map((item, idx) => (
            <span key={item.id}>
              {idx > 0 && <Separator className="ml-4" />}
              <button
                className="w-full text-left px-6 py-3 hover:bg-accent transition-colors"
                onClick={() => { onEdit(item); onClose() }}
              >
                <p className="text-sm font-medium">{item.name}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {item.category === null && (
                    <Badge variant="outline" className="text-[11px] h-5 border-amber-500 text-amber-600">
                      {t('incompleteItems.noCategory')}
                    </Badge>
                  )}
                  {item.supermarkets.length === 0 && (
                    <Badge variant="outline" className="text-[11px] h-5 border-amber-500 text-amber-600">
                      {t('incompleteItems.noSupermarket')}
                    </Badge>
                  )}
                </div>
              </button>
            </span>
          ))}
        </div>

        <Separator />

        <DrawerFooter className="pb-6">
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t('common.close')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
