import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  useHouseholdSettings,
  useTodoWorkflow,
  useUpdateTodoWorkflow,
  type TodoWorkflow,
} from '../../api/household'
import ConceptManager from './ConceptManager'
import { useTranslation } from 'react-i18next'

interface TodosSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function TodosSettings({ setHeader }: TodosSettingsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  const { data: todoSettings } = useTodoWorkflow()
  const { mutate: updateWorkflow } = useUpdateTodoWorkflow()

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
        <h1 className="flex-1 text-lg font-bold">{t('settings.todos.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  const workflow = todoSettings?.workflow ?? 'simple'

  function handleWorkflowChange(val: string) {
    if (!val) return
    updateWorkflow(val as TodoWorkflow)
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">{t('settings.todos.workflowMode')}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {t('settings.todos.workflowDescription')}
        </p>
        {isOwner ? (
          <div className="space-y-3">
            <ToggleGroup
              type="single"
              variant="outline"
              value={workflow}
              onValueChange={handleWorkflowChange}
            >
              <ToggleGroupItem value="simple" className="flex-1">
                {t('settings.todos.simple')}
              </ToggleGroupItem>
              <ToggleGroupItem value="board" className="flex-1">
                {t('settings.todos.board')}
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {workflow === 'simple'
                ? t('settings.todos.simpleDescription')
                : t('settings.todos.boardDescription')}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground capitalize">{workflow}</p>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('settings.todos.categoriesHelp')}
        </p>
        <ConceptManager
          type="todo-categories"
          label={t('settings.todos.categories')}
          addPlaceholder={t('settings.todos.addCategory')}
          ownerOnly={isOwner}
        />
      </div>
    </div>
  )
}
