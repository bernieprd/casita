import { type ThemePrefs, COLOR_PRESETS, FONT_OPTIONS, HEADING_FONT_OPTIONS, DEFAULT_THEME, loadGoogleFont } from '@/lib/theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Sun, SunMoon, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeCustomizerProps {
  prefs: ThemePrefs
  setPrefs: (prefs: ThemePrefs) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  readOnly?: boolean
  isPending?: boolean
}

export function ThemeCustomizer({ prefs, setPrefs, open, onOpenChange, readOnly, isPending }: ThemeCustomizerProps) {
  const isMobile = useIsMobile()
  const radiusValue = Math.round(parseFloat(prefs.radius) / 0.0625)

  const innerContent = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Appearance
        </Label>
        <ToggleGroup
          type="single"
          value={prefs.colorScheme}
          onValueChange={(value) => {
            if (!value || isPending) return
            setPrefs({ ...prefs, colorScheme: value as ThemePrefs['colorScheme'] })
          }}
          className={cn('justify-start [&_[data-state=on]]:bg-primary [&_[data-state=on]]:text-primary-foreground', isPending && 'opacity-50 pointer-events-none')}
        >
          <ToggleGroupItem value="light" aria-label="Light mode">
            <Sun className="h-4 w-4" />
            <span className="ml-1 text-sm">Light</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="system" aria-label="System default">
            <SunMoon className="h-4 w-4" />
            <span className="ml-1 text-sm">System</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark mode">
            <Moon className="h-4 w-4" />
            <span className="ml-1 text-sm">Dark</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Color
        </Label>
        <div className={(readOnly || isPending) ? 'opacity-50 pointer-events-none' : ''}>
          <div className="flex gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                title={preset.label}
                aria-label={preset.label}
                onClick={() => setPrefs({ ...prefs, primaryHsl: preset.hsl })}
                className={cn(
                  'h-8 w-8 rounded-full transition-all',
                  prefs.primaryHsl === preset.hsl
                    ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                    : 'hover:scale-105',
                )}
                style={{ backgroundColor: `hsl(${preset.hsl})` }}
              />
            ))}
          </div>
        </div>
        {readOnly && (
          <p className="text-xs text-muted-foreground">Color, fonts, and radius are set by the household owner.</p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Heading Font
        </Label>
        <div className={(readOnly || isPending) ? 'opacity-50 pointer-events-none' : ''}>
          <Select
            value={prefs.headingFont}
            onValueChange={(value) => {
              const option = HEADING_FONT_OPTIONS.find((o) => o.value === value)
              if (option?.googleFamily) loadGoogleFont(option.googleFamily)
              setPrefs({ ...prefs, headingFont: value })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEADING_FONT_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Body Font
        </Label>
        <div className={(readOnly || isPending) ? 'opacity-50 pointer-events-none' : ''}>
          <Select
            value={prefs.bodyFont}
            onValueChange={(value) => {
              const option = FONT_OPTIONS.find((o) => o.value === value)
              if (option?.googleFamily) loadGoogleFont(option.googleFamily)
              setPrefs({ ...prefs, bodyFont: value })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Radius
        </Label>
        <div className={(readOnly || isPending) ? 'opacity-50 pointer-events-none' : ''}>
          <Slider
            min={0}
            max={16}
            step={1}
            value={[radiusValue]}
            onValueChange={([v]) => {
              const rem = v === 0 ? '0rem' : `${(v * 0.0625).toFixed(3).replace(/\.?0+$/, '')}rem`
              setPrefs({ ...prefs, radius: rem })
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>None</span>
            <span>Rounded</span>
          </div>
        </div>
      </div>

      {!readOnly && (
        <>
          <Separator />
          <Button variant="ghost" onClick={() => setPrefs(DEFAULT_THEME)} className="w-full" disabled={isPending}>
            Reset to defaults
          </Button>
        </>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className="rounded-t-2xl flex flex-col max-h-[80dvh]">
          <DrawerHeader>
            <DrawerTitle>Customize Theme</DrawerTitle>
            <DrawerDescription className="sr-only">Customize the app's appearance.</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {innerContent}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm flex flex-col gap-6">
        <DialogHeader>
          <DialogTitle>Customize Theme</DialogTitle>
          <DialogDescription className="sr-only">Customize the app's appearance.</DialogDescription>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  )
}
