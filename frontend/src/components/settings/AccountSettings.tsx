import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useUser } from '@clerk/clerk-react'
import { useAuth } from '../../context/AuthContext'
import { useDeleteAccount, useExportAccount } from '../../api/account'
import { useHouseholdSettings } from '../../api/household'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function AccountSettings({ setHeader }: Props) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { logout } = useAuth()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  const { mutate: deleteAccount, isPending: deletingAccount } = useDeleteAccount()
  const { mutate: exportAccount, isPending: exportingAccount } = useExportAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="-ml-2"
          aria-label="Back to Settings"
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">Account</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  return (
    <div className="p-4">

      {/* Profile */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Profile
      </p>

      <div className="flex items-center gap-3 mb-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ''} />
          <AvatarFallback aria-label={user?.fullName?.[0] ?? 'User avatar'}>
            {user?.fullName?.[0] ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {user?.fullName && (
            <p className="text-sm font-medium truncate">{user.fullName}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">
            {user?.primaryEmailAddress?.emailAddress ?? ''}
          </p>
        </div>
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={logout}
        className="mb-1"
      >
        Sign out
      </Button>

      <Separator className="my-4" />

      {/* Danger zone */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Danger Zone
      </p>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => exportAccount()}
            disabled={exportingAccount}
          >
            {exportingAccount ? 'Preparing…' : 'Download my data'}
          </Button>
        </div>

        {isOwner && (householdData?.members?.length ?? 0) > 1 ? (
          <div className="flex flex-col items-start gap-0.5">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive/40 border-destructive/20 cursor-not-allowed"
              disabled
            >
              Delete account
            </Button>
            <p className="text-xs text-muted-foreground">
              Transfer ownership to another member first
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </Button>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner && (householdData?.members?.length ?? 0) <= 1
                ? <>
                    Deleting your account will also permanently delete your household
                    {householdData?.householdName ? ` "${householdData.householdName}"` : ''}{' '}
                    and everything in it — all recipes, shopping items, to-dos, and your
                    Google Calendar connection. This cannot be undone.
                  </>
                : <>
                    Your personal information (email, profile, calendar connection) will be
                    permanently deleted. Recipes, shopping items, and to-dos you contributed
                    to the household will remain for other members and will no longer be
                    linked to you. This cannot be undone.
                  </>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingAccount}
              onClick={(e) => {
                e.preventDefault()
                deleteAccount(undefined, {
                  onSuccess: () => { setDeleteOpen(false); logout() },
                  onError: (err: unknown) =>
                    toast.error((err as { message?: string })?.message ?? 'Failed to delete account'),
                })
              }}
            >
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
