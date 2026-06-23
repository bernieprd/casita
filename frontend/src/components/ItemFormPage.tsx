import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { ArrowLeft, ChevronsUpDown, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, useConceptList } from '../api'
import type { Item } from '../api'
import { useTranslation } from 'react-i18next'

export default function ItemFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: allItems = [] } = useItems()
  const item = allItems.find(i => i.id === id)
  const { data: categoryConcepts = [] } = useConceptList('categories')
  const { data: supermarketConcepts = [] } = useConceptList('supermarkets')
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [supermarkets, setSupermarkets] = useState<string[]>([])
  const [onShoppingList, setOnShoppingList] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [supermarketOpen, setSupermarketOpen] = useState(false)
  const [supermarketSearch, setSupermarketSearch] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const saveDoneRef = useRef(false)

  type Snapshot = { name: string; category: string | null; supermarkets: string[]; onShoppingList: boolean }
  const snapshot = useRef<Snapshot | null>(null)

  useEffect(() => {
    saveDoneRef.current = false
    if (initialized) return
    if (!isEdit) {
      snapshot.current = { name: '', category: null, supermarkets: [], onShoppingList: false }
      setInitialized(true)
      return
    }
    if (!item) return
    setName(item.name)
    setCategory(item.category)
    setSupermarkets(item.supermarkets)
    setOnShoppingList(item.onShoppingList)
    snapshot.current = { name: item.name, category: item.category, supermarkets: [...item.supermarkets], onShoppingList: item.onShoppingList }
    setInitialized(true)
  }, [initialized, isEdit, item])

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

  const isPending = (isEdit ? updateItem : createItem).isPending || deleteItem.isPending

  const isDirty = useMemo(() => {
    if (!snapshot.current) return false
    const s = snapshot.current
    return name !== s.name || category !== s.category ||
      JSON.stringify(supermarkets) !== JSON.stringify(s.supermarkets) ||
      onShoppingList !== s.onShoppingList
  }, [name, category, supermarkets, onShoppingList])

  const blocker = useBlocker(() => !saveDoneRef.current && isDirty && !isPending)

  function handleSave() {
    if (!name.trim()) { setNameError(true); return }
    if (isEdit && id) {
      updateItem.mutate(
        { id, data: { name: name.trim(), category, supermarkets, onShoppingList } },
        { onSuccess: () => { saveDoneRef.current = true; navigate(-1) } }
      )
    } else {
      createItem.mutate(
        { name: name.trim(), category, supermarkets, onShoppingList },
        { onSuccess: () => { saveDoneRef.current = true; navigate('/shopping', { replace: true }) } }
      )
    }
  }

  function handleDelete() {
    if (!id) return
    deleteItem.mutate(id, {
      onSuccess: () => { saveDoneRef.current = true; navigate('/shopping', { replace: true }) }
    })
  }

  return (
    <div className="h-dvh bg-background flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-background border-b shrink-0">
        <div className="max-w-xl mx-auto flex items-center px-2 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} disabled={isPending} className="-ml-2">
            <ArrowLeft />
          </Button>
          <h1 className="flex-1 text-lg font-bold">{isEdit ? t('item.editTitle') : t('item.newTitle')}</h1>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleSave}>
            {isPending
              ? isEdit ? t('common.saving') : t('common.creating')
              : isEdit ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 overflow-y-auto overscroll-contain flex-1 max-w-xl mx-auto w-full">
        {isEdit && !initialized ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('item.nameLabel', { defaultValue: 'Name' })}</label>
              <Input
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (nameError) setNameError(false)
                }}
                placeholder={t('item.namePlaceholder')}
                className={nameError ? 'border-destructive' : ''}
                autoFocus={!isEdit}
              />
              {nameError && <p className="text-xs text-destructive">{t('item.nameRequired', { defaultValue: 'Name is required' })}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('item.categoryLabel', { defaultValue: 'Category' })}</label>
              {!showCategoryInput ? (
                <Select
                  value={category ?? '__none__'}
                  onValueChange={v => {
                    if (v === '__new__') { setShowCategoryInput(true); setNewCategoryInput('') }
                    else { setCategory(v === '__none__' ? null : v) }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('todos.noneOption')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('todos.noneOption')}</SelectItem>
                    {categoryOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                    <SelectItem value="__new__">{t('todos.newCategory')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCategoryInput.trim()) { setCategory(newCategoryInput.trim()); setShowCategoryInput(false) }
                      if (e.key === 'Escape') setShowCategoryInput(false)
                    }}
                    placeholder={t('todos.categoryNamePlaceholder')}
                    className="flex-1"
                  />
                  <Button size="sm" disabled={!newCategoryInput.trim()}
                    onClick={() => { setCategory(newCategoryInput.trim()); setShowCategoryInput(false) }}>
                    {t('common.add')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCategoryInput(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('item.supermarketsLabel', { defaultValue: 'Supermarkets' })}</label>
              <div className="flex flex-col gap-2">
                {supermarkets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {supermarkets.map(s => (
                      <Badge key={s} variant="secondary" className="gap-1 pr-1">
                        {s}
                        <button type="button" onClick={() => setSupermarkets(prev => prev.filter(x => x !== s))}>
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Popover open={supermarketOpen} onOpenChange={setSupermarketOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {supermarkets.length === 0 ? t('item.supermarketsPlaceholder') : t('item.supermarketsSelected', { count: supermarkets.length, defaultValue: `${supermarkets.length} selected` })}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search supermarkets…"
                        value={supermarketSearch}
                        onValueChange={setSupermarketSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {supermarketSearch.trim() ? (
                            <button
                              className="w-full px-4 py-2 text-sm text-left hover:bg-accent"
                              onClick={() => {
                                const v = supermarketSearch.trim()
                                if (v && !supermarkets.includes(v)) setSupermarkets(prev => [...prev, v])
                                setSupermarketSearch('')
                              }}
                            >
                              + Add "{supermarketSearch.trim()}"
                            </button>
                          ) : 'No supermarkets found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {supermarketOptions.map(opt => {
                            const selected = supermarkets.includes(opt)
                            return (
                              <CommandItem
                                key={opt}
                                value={opt}
                                onSelect={() => {
                                  setSupermarkets(prev =>
                                    selected ? prev.filter(x => x !== opt) : [...prev, opt]
                                  )
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                                {opt}
                              </CommandItem>
                            )
                          })}
                          {supermarketSearch.trim() && !supermarketOptions.some(o => o.toLowerCase() === supermarketSearch.toLowerCase()) && (
                            <CommandItem
                              value={`__add__${supermarketSearch}`}
                              onSelect={() => {
                                const v = supermarketSearch.trim()
                                if (v && !supermarkets.includes(v)) setSupermarkets(prev => [...prev, v])
                                setSupermarketSearch('')
                              }}
                            >
                              + Add "{supermarketSearch.trim()}"
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('item.onShoppingListLabel', { defaultValue: 'On shopping list' })}</label>
              <Switch checked={onShoppingList} onCheckedChange={setOnShoppingList} />
            </div>

            {isEdit && initialized && (
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive w-full"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isPending}
                >
                  {t('common.delete')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('todos.unsavedChanges', { defaultValue: 'Unsaved changes' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('todos.unsavedChangesDesc', { defaultValue: 'You have unsaved changes. Leave anyway?' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('todos.keepEditing', { defaultValue: 'Keep editing' })}</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>{t('common.leave')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shopping.deleteItemTitle', { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('shopping.deleteItemDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteItem.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
