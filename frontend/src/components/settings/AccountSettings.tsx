import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useUser } from '@clerk/clerk-react'
import { useAuth } from '../../context/AuthContext'
import { useDeleteAccount, useExportAccount } from '../../api/account'
import { useHouseholdSettings } from '../../api/household'
import { useMe, useUpdateLocale } from '../../api/me'
import i18n, { SUPPORTED_LOCALES, type LocaleCode } from '../../i18n'
import { translateError } from '../../lib/errors'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function AccountSettings({ setHeader }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { logout } = useAuth()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  const { mutate: deleteAccount, isPending: deletingAccount } = useDeleteAccount()
  const { mutate: exportAccount, isPending: exportingAccount } = useExportAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: meData } = useMe()
  const { mutate: updateLocale } = useUpdateLocale()

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="-ml-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.account.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  return (
    <div className="p-4">

      {/* Profile */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {t('settings.account.profile')}
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

      <div className="flex gap-2 mb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
        >
          {t('common.signOut')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => exportAccount(undefined, {
            onSuccess: () => toast.success(t('settings.account.dataDownloading')),
          })}
          disabled={exportingAccount}
        >
          <Download className="h-4 w-4" />
          {exportingAccount ? t('common.preparing') : t('settings.account.downloadData')}
        </Button>
      </div>

      <Separator className="my-4" />

      {/* Language */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {t('settings.account.language')}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {t('settings.account.languageDescription')}
      </p>
      <Select
        value={meData?.locale ?? 'en'}
        onValueChange={(value) => {
          i18n.changeLanguage(value as LocaleCode)
          updateLocale(value as LocaleCode)
        }}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map(({ code, label }) => (
            <SelectItem key={code} value={code}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator className="my-4" />

      {/* Danger zone */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {t('settings.account.dangerZone')}
      </p>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        {isOwner && (householdData?.members?.length ?? 0) > 1 ? (
          <div className="flex flex-col items-start gap-0.5">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive/40 border-destructive/20 cursor-not-allowed"
              disabled
            >
              {t('settings.account.deleteAccount')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('settings.account.transferOwnershipFirst')}
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            {t('settings.account.deleteAccount')}
          </Button>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.account.deleteAccountTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner && (householdData?.members?.length ?? 0) <= 1
                ? t('settings.account.deleteAccountOwnerDescription', {
                    householdName: householdData?.householdName ? `"${householdData.householdName}"` : '',
                  })
                : t('settings.account.deleteAccountMemberDescription')
              }
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
                  onSuccess: () => { setDeleteOpen(false); logout() },
                  onError: (err: unknown) =>
                    toast.error(translateError((err as { message?: string })?.message ?? '', t)),
                })
              }}
            >
              {t('settings.account.deleteAccount')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
