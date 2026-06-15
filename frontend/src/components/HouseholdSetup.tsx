import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import { api } from '../api/client'
import { useHousehold } from '../context/AuthContext'
import { useDeleteAccount } from '../api/account'
import { useTranslation } from 'react-i18next'
import { translateError } from '@/lib/errors'

export default function HouseholdSetup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { householdId, isLoading, refreshHousehold } = useHousehold()
  const { mutate: deleteAccount, isPending: deletingAccount } = useDeleteAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)
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
      localStorage.setItem('casita_onboarding_pending', 'created')
      refreshHousehold()
    } catch (err) {
      setCreateError(translateError(err instanceof Error ? err.message : 'ERR_INTERNAL', t))
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
      localStorage.setItem('casita_onboarding_pending', 'joined')
      refreshHousehold()
      navigate('/', { replace: true })
    } catch (err) {
      setJoinError(translateError(err instanceof Error ? err.message : 'ERR_INTERNAL', t))
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1 text-center">{t('household.setup.welcome')}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {t('household.setup.getStarted')}
        </p>

        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <Tabs value={tab} onValueChange={v => setTab(v as 'create' | 'join')}>
            <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent">
              <TabsTrigger value="create" className="flex-1 rounded-none py-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                {t('household.setup.createTab')}
              </TabsTrigger>
              <TabsTrigger value="join" className="flex-1 rounded-none py-3 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                {t('household.setup.joinTab')}
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="create">
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {t('household.setup.createDescription')}
                  </p>
                  <Input
                    placeholder={t('household.setup.householdNamePlaceholder')}
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
                    {createLoading ? t('common.creating') : t('household.setup.createButton')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join">
                <form onSubmit={handleJoin} className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {t('household.setup.joinDescription')}
                  </p>
                  <Input
                    placeholder={t('household.setup.inviteCodePlaceholder')}
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    required
                    autoFocus
                    style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
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
                    {joinLoading ? t('common.joining') : t('household.setup.joinButton')}
                  </Button>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="text-center pt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => signOut(() => navigate('/sign-in', { replace: true }))}
              className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors"
            >
              {t('common.signOut')}
            </button>
            <span className="text-xs text-muted-foreground/40">·</span>
            <button
              onClick={() => setDeleteOpen(true)}
              className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors"
            >
              {t('settings.account.deleteAccount')}
            </button>
          </div>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.account.deleteAccountTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.account.deleteAccountMemberDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={deletingAccount}
                  onClick={(e) => {
                    e.preventDefault()
                    deleteAccount(undefined, {
                      onSuccess: () => { setDeleteOpen(false); signOut(() => navigate('/sign-in', { replace: true })) },
                      onError: (err: unknown) => {
                        toast.error(translateError((err as { message?: string })?.message ?? 'ERR_INTERNAL', t))
                      },
                    })
                  }}
                >
                  {t('settings.account.deleteAccount')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
