import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { toast } from 'sonner'
import {
  Home,
  CalendarDays,
  CheckSquare,
  ShoppingCart,
  BookOpen,
  Plus,
  Trash2,
  Paintbrush,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeCustomizer } from './ThemeCustomizer'
import { useTheme } from '@/hooks/useTheme'

const NAV_TABS = [
  { label: 'Home',     Icon: Home },
  { label: 'Calendar', Icon: CalendarDays },
  { label: 'Todos',    Icon: CheckSquare },
  { label: 'Shopping', Icon: ShoppingCart },
  { label: 'Recipes',  Icon: BookOpen },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function ThemePreview() {
  const { prefs, setPrefs } = useTheme()
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Home')

  return (
    <div data-vaul-drawer-wrapper className="min-h-screen bg-white bg-background text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-14 max-w-lg mx-auto items-center px-4 gap-3">
          <span className="font-bold text-lg flex-1 text-foreground">Casita</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">BP</AvatarFallback>
          </Avatar>
          <Button size="icon" variant="ghost" onClick={() => setCustomizerOpen(true)}>
            <Paintbrush className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-10 pb-28">
        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Heading 1</h1>
            <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
            <h3 className="text-2xl font-semibold">Heading 3</h3>
            <h4 className="text-xl font-semibold">Heading 4</h4>
            <p className="text-base leading-7">
              Body text. The quick brown fox jumps over the lazy dog. Shopping lists, recipe steps, and household todos.
            </p>
            <p className="text-sm text-muted-foreground">
              Muted text. Used for secondary information, labels, and timestamps.
            </p>
          </div>
        </Section>

        <Separator />

        {/* Buttons */}
        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="sm" variant="outline">
              Small Outline
            </Button>
            <Button size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Separator />

        {/* Form controls */}
        <Section title="Form Controls">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-name">Item name</Label>
              <Input id="item-name" placeholder="e.g. Olive oil" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Add notes…" rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produce">Produce</SelectItem>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="meat">Meat &amp; Fish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="notify" />
              <Label htmlFor="notify">Notify when added</Label>
            </div>
            <RadioGroup defaultValue="weekly" className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily">Daily</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly">Weekly</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly">Monthly</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Checkbox id="recurring" />
              <Label htmlFor="recurring">Mark as recurring</Label>
            </div>
          </div>
        </Section>

        <Separator />

        {/* Cards */}
        <Section title="Cards">
          <div className="grid grid-cols-2 gap-3">
            <Card className="overflow-hidden">
              <div className="aspect-video bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary/40" />
              </div>
              <CardContent className="p-3 space-y-1.5">
                <p className="font-medium text-sm leading-snug">Pasta al Pomodoro</p>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="secondary">Italian</Badge>
                  <Badge variant="outline">30 min</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-sm">Shopping list</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {['Tomatoes', 'Olive oil', 'Basil'].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Checkbox id={item.replace(/\s+/g, '-')} />
                    <Label htmlFor={item.replace(/\s+/g, '-')} className="flex-1 text-sm cursor-pointer">
                      {item}
                    </Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="p-3">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">Draggable item example</span>
              <Badge>Active</Badge>
            </div>
          </Card>
        </Section>

        <Separator />

        {/* Overlays */}
        <Section title="Overlays">
          <div className="flex gap-2 flex-wrap">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm action</DialogTitle>
                  <DialogDescription>
                    This is a sample dialog. Use dialogs for desktop confirmations and forms.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline">Cancel</Button>
                  <Button>Confirm</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Drawer shouldScaleBackground>
              <DrawerTrigger asChild>
                <Button variant="outline">Open Drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Bottom Sheet</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-8 text-sm text-muted-foreground">
                  Vaul-based bottom sheet — used for mobile forms and actions.
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </Section>

        <Separator />

        {/* Badges */}
        <Section title="Badges &amp; Status">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </Section>

        <Separator />

        {/* Skeleton */}
        <Section title="Loading State">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[180px]" />
          </div>
          <Card className="p-3">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </div>
          </Card>
        </Section>

        <Separator />

        {/* Toast */}
        <Section title="Notifications">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() =>
                toast('Shopping list updated!', { description: '3 items added successfully.' })
              }
            >
              Show toast
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.error('Something went wrong', { description: 'Please try again.' })}
            >
              Show error
            </Button>
          </div>
        </Section>

        <Separator />

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="shopping">
            <TabsList className="w-full">
              <TabsTrigger value="shopping" className="flex-1">
                Shopping
              </TabsTrigger>
              <TabsTrigger value="recipes" className="flex-1">
                Recipes
              </TabsTrigger>
              <TabsTrigger value="todos" className="flex-1">
                Todos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="shopping" className="p-3 text-sm text-muted-foreground">
              Shopping list content — weekly groceries, pantry staples.
            </TabsContent>
            <TabsContent value="recipes" className="p-3 text-sm text-muted-foreground">
              Recipe browser — filter by tag, cuisine, or ingredient.
            </TabsContent>
            <TabsContent value="todos" className="p-3 text-sm text-muted-foreground">
              Household todos — assigned, due dates, recurring chores.
            </TabsContent>
          </Tabs>
        </Section>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-white bg-background z-50">
        <div className="flex max-w-lg mx-auto">
          {NAV_TABS.map(({ label, Icon }) => (
            <button
              key={label}
              onClick={() => setActiveNav(label)}
              className={cn(
                'flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors',
                activeNav === label
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <ThemeCustomizer
        prefs={prefs}
        setPrefs={setPrefs}
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
      />
    </div>
  )
}
