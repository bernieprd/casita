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

interface TodosSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function TodosSettings({ setHeader }: TodosSettingsProps) {
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
          aria-label="Back to Settings"
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">To-Dos</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  const workflow = todoSettings?.workflow ?? 'simple'

  function handleWorkflowChange(val: string) {
    if (!val) return
    updateWorkflow(val as TodoWorkflow)
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Workflow mode</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Choose how to-dos flow through your household.
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
                Simple
              </ToggleGroupItem>
              <ToggleGroupItem value="board" className="flex-1">
                Board
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {workflow === 'simple'
                ? 'Simple: To-Do → Done'
                : 'Board: To-Do → In Progress → Blocked → Done'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground capitalize">{workflow}</p>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Categories help you organize and filter your to-do list.
        </p>
        <ConceptManager
          type="todo-categories"
          label="Categories"
          addPlaceholder="Add a category"
          ownerOnly={isOwner}
        />
      </div>
    </div>
  )
}
