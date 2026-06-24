import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export function useSettingsBack() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    () => location.key === 'default' ? navigate('/menu') : navigate(-1),
    [navigate, location],
  )
}
