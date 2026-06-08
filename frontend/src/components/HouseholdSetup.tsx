import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import { api } from '../api/client'
import { useHousehold } from '../context/AuthContext'

export default function HouseholdSetup() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { householdId, isLoading, refreshHousehold } = useHousehold()
  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create flow state
  const [householdName, setHouseholdName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join flow state
  const [inviteCode, setInviteCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && householdId !== null) navigate('/', { replace: true })
  }, [householdId, isLoading, navigate])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)
    try {
      await api.post<{ id: string; name: string }>('/household', {
        name: householdName.trim(),
      })
      refreshHousehold()
      navigate('/', { replace: true })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create household')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)
    setJoinLoading(true)
    try {
      await api.post<{ id: string; name: string }>('/household/join', { inviteCode: inviteCode.trim() })
      refreshHousehold()
      navigate('/', { replace: true })
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join household')
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1 text-center">Welcome to Casita</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Set up your household to get started
        </p>

        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <Tabs value={tab} onValueChange={v => setTab(v as 'create' | 'join')}>
            <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent">
              <TabsTrigger value="create" className="flex-1 rounded-none py-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Create household
              </TabsTrigger>
              <TabsTrigger value="join" className="flex-1 rounded-none py-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Join with code
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="create">
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Start a new household and invite your housemates.
                  </p>
                  <Input
                    placeholder="Household name (e.g. The Smith House)"
                    value={householdName}
                    onChange={e => setHouseholdName(e.target.value)}
                    required
                    autoFocus
                  />
                  {createError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                      {createError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={createLoading || !householdName.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {createLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                    )}
                    {createLoading ? 'Creating…' : 'Create household'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoin} className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the invite code shared by a housemate.
                  </p>
                  <Input
                    placeholder="Invite code (e.g. ABC-123)"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    required
                    autoFocus
                    style={{ textTransform: 'uppercase', letterSpacing: 2 }}
                  />
                  {joinError && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                      {joinError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={joinLoading || !inviteCode.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {joinLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                    )}
                    {joinLoading ? 'Joining…' : 'Join household'}
                  </Button>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => signOut(() => navigate('/sign-in', { replace: true }))}
            className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
