import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { useItems, useCreateItem, useUpdateItem, useConceptList } from '../api'
import type { Item } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  item?: Item | null   // null/undefined = create mode
  onClose: () => void
  onDeleteRequest?: () => void  // called when user taps Delete in edit mode
}

export default function ItemFormDialog({ open, item, onClose, onDeleteRequest }: Props) {
  const { t } = useTranslation()
  const { data: allItems = [] } = useItems()
  const { data: categoryConcepts = [] } = useConceptList('categories')
  const { data: supermarketConcepts = [] } = useConceptList('supermarkets')
  const create = useCreateItem()
  const update = useUpdateItem()
  const isMobile = window.innerWidth < 768

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [supermarkets, setSupermarkets] = useState<string[]>([])
  const [supermarketInput, setSupermarketInput] = useState('')

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setCategory(item?.category ?? null)
      setSupermarkets(item?.supermarkets ?? [])
      setSupermarketInput('')
    }
  }, [open, item])

  const categoryOptions = useMemo(() => {
    const fromConcepts = categoryConcepts.map(c => c.name)
    const fromItems = allItems.map(i => i.category).filter((c): c is string => !!c)
    return [...new Set([...fromConcepts, ...fromItems])].sort()
  }, [categoryConcepts, allItems])

  const supermarketOptions = useMemo(() => {
    const fromConcepts = supermarketConcepts.map(c => c.name)
    const fromItems = allItems.flatMap(i => i.supermarkets)
    return [...new Set([...fromConcepts, ...fromItems])].sort()
  }, [supermarketConcepts, allItems])

  const isEdit = !!item
  const isPending = create.isPending || update.isPending
  const canSubmit = name.trim().length > 0 && !isPending

  function handleSubmit() {
    const finalSupermarkets = supermarketInput.trim()
      ? [...new Set([...supermarkets, supermarketInput.trim()])]
      : supermarkets
    const data = { name: name.trim(), category, supermarkets: finalSupermarkets, onShoppingList: item?.onShoppingList ?? false }
    if (isEdit) {
      update.mutate({ id: item.id, data }, { onSuccess: onClose })
    } else {
      create.mutate(data, { onSuccess: onClose })
    }
  }

  function addSupermarket(value: string) {
    const trimmed = value.trim()
    if (trimmed) setSupermarkets(prev => [...new Set([...prev, trimmed])])
  }

  function removeSupermarket(val: string) {
    setSupermarkets(prev => prev.filter(s => s !== val))
  }

  const categoryListId = 'item-category-list'
  const supermarketListId = 'item-supermarket-list'

  const formContent = (
    <div className="flex flex-col gap-4">
      <datalist id={categoryListId}>
        {categoryOptions.map(o => <option key={o} value={o} />)}
      </datalist>
      <datalist id={supermarketListId}>
        {supermarketOptions.map(o => <option key={o} value={o} />)}
      </datalist>

      <Input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
        placeholder={t('item.namePlaceholder')}
      />
      <Input
        value={category ?? ''}
        onChange={e => setCategory(e.target.value.replace(/,/g, '') || null)}
        placeholder={t('item.categoryPlaceholder')}
        list={categoryListId}
      />
      <div className="flex flex-col gap-1.5">
        {supermarkets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {supermarkets.map(s => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-medium"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSupermarket(s)}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          value={supermarketInput}
          onChange={e => {
            const v = e.target.value
            if (v.includes(',')) {
              addSupermarket(v.replace(/,/g, ''))
              setSupermarketInput('')
            } else {
              setSupermarketInput(v)
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && supermarketInput.trim()) {
              e.preventDefault()
              addSupermarket(supermarketInput)
              setSupermarketInput('')
            }
          }}
          onBlur={() => {
            if (supermarketInput.trim()) {
              addSupermarket(supermarketInput)
              setSupermarketInput('')
            }
          }}
          placeholder={t('item.supermarketsPlaceholder')}
          list={supermarketListId}
        />
      </div>
    </div>
  )

  const actions = (
    <div className="flex justify-between items-center w-full">
      {isEdit && onDeleteRequest
        ? <Button variant="ghost" onClick={onDeleteRequest} className="text-destructive hover:text-destructive">{t('common.delete')}</Button>
        : <span />
      }
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={v => { if (!v) onClose() }} dismissible>
        <DrawerContent
          className="rounded-t-2xl flex flex-col max-h-[80dvh]"
        >
          <DrawerHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base font-semibold">
                {isEdit ? t('item.editTitle') : t('item.newTitle')}
              </DrawerTitle>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
            <DrawerDescription className="sr-only">
              {isEdit ? t('item.editDescription') : t('item.newDescription')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 overflow-auto flex-1 overscroll-contain">
            {formContent}
          </div>
          <DrawerFooter className="border-t shrink-0">
            {actions}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('item.editTitle') : t('item.newTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t('item.editDescription') : t('item.newDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="pt-1">
          {formContent}
        </div>
        <DialogFooter className="px-0 pb-0">
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
