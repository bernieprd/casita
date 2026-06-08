import { type ThemePrefs, COLOR_PRESETS, FONT_OPTIONS, HEADING_FONT_OPTIONS, DEFAULT_THEME, loadGoogleFont } from '@/lib/theme'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
}

export function ThemeCustomizer({ prefs, setPrefs, open, onOpenChange }: ThemeCustomizerProps) {
  const isMobile = window.innerWidth < 768
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
            if (!value) return
            setPrefs({ ...prefs, colorScheme: value as ThemePrefs['colorScheme'] })
          }}
          className="justify-start"
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
        <div className="flex gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              title={preset.label}
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

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Heading Font
        </Label>
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

      <Separator />

      <div className="flex flex-col gap-3">
        <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Body Font
        </Label>
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

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Radius
          </Label>
          <span className="text-sm text-muted-foreground">{prefs.radius}</span>
        </div>
        <Slider
          min={0}
          max={16}
          step={1}
          value={[radiusValue]}
          onValueChange={([v]) => {
            const rem = v === 0 ? '0rem' : `${(v * 0.0625).toFixed(3).replace(/0+$/, '')}rem`
            setPrefs({ ...prefs, radius: rem })
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>None</span>
          <span>Rounded</span>
        </div>
      </div>

      <Separator />

      <Button variant="ghost" onClick={() => setPrefs(DEFAULT_THEME)} className="w-full">
        Reset to defaults
      </Button>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="min-w-[320px] flex flex-col gap-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customize Theme</SheetTitle>
          </SheetHeader>
          {innerContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm flex flex-col gap-6">
        <DialogHeader>
          <DialogTitle>Customize Theme</DialogTitle>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  )
}
