import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GitMerge, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { useMergeItems } from '../api'
import type { Item } from '../api'

interface Props {
  open: boolean
  groups: Item[][]
  onClose: () => void
}

export default function MergeDuplicatesSheet({ open, groups, onClose }: Props) {
  const { t } = useTranslation()
  const [keepers, setKeepers] = useState<Record<number, string>>({})
  const [merging, setMerging] = useState(false)
  const mergeItems = useMergeItems()

  useEffect(() => {
    if (open) {
      setKeepers(Object.fromEntries(groups.map((g, i) => [i, g[0].id])))
    }
  }, [open, groups])

  async function handleMergeAll() {
    setMerging(true)
    try {
      for (let i = 0; i < groups.length; i++) {
        const keepId = keepers[i] ?? groups[i][0].id
        const discards = groups[i].filter(item => item.id !== keepId)
        for (const discard of discards) {
          await mergeItems.mutateAsync({ discardId: discard.id, keepId })
        }
      }
      onClose()
    } finally {
      setMerging(false)
    }
  }

  const totalDuplicates = groups.reduce((sum, g) => sum + g.length - 1, 0)

  const description = groups.length === 1
    ? t('mergeItems.appearsNTimes', { name: groups[0][0].name, count: groups[0].length }) + t('mergeItems.pickerNote')
    : t('mergeItems.namesAppear', { count: groups.length }) + t('mergeItems.pickerNote')

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => { if (!o && !merging) onClose() }}
      disablePreventScroll
    >
      <DrawerContent
        className="flex flex-col max-h-[80dvh]"
      >
        <DrawerHeader className="text-left pb-3">
          <DrawerTitle>{t('mergeItems.title')}</DrawerTitle>
          <DrawerDescription>
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <Separator />

        <div className="overflow-auto flex-1 overscroll-contain">
          {groups.map((group, i) => (
            <div key={group[0].name + i} className="px-6 py-4">
              {i > 0 && <Separator className="-mx-6 mb-4" />}
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
                {group[0].name}
              </p>
              <RadioGroup
                value={keepers[i] ?? group[0].id}
                onValueChange={(val) => setKeepers(prev => ({ ...prev, [i]: val }))}
                disabled={merging}
              >
                {group.map(item => (
                  <div key={item.id} className="flex items-start gap-2 mt-1">
                    <RadioGroupItem value={item.id} id={`item-${item.id}`} className="mt-1" />
                    <Label htmlFor={`item-${item.id}`} className="py-1 cursor-pointer">
                      <div className="flex gap-1 flex-wrap">
                        {item.category && (
                          <Badge variant="outline" className="text-[11px] h-5">
                            {item.category}
                          </Badge>
                        )}
                        {item.supermarkets.map(s => (
                          <Badge key={s} variant="secondary" className="text-[11px] h-5">
                            {s}
                          </Badge>
                        ))}
                        {!item.category && item.supermarkets.length === 0 && (
                          <span className="text-xs text-muted-foreground/60">{t('mergeItems.noDetails')}</span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        <Separator />

        <DrawerFooter className="pb-6 gap-1">
          <Button
            className="w-full"
            onClick={handleMergeAll}
            disabled={merging}
          >
            {merging
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('mergeItems.merging')}</>
              : <><GitMerge className="mr-2 h-4 w-4" />{t('mergeItems.removeDuplicates', { count: totalDuplicates })}</>
            }
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={merging} className="w-full">
            {t('common.cancel')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
