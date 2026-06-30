import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Makes a modal history-aware so the device back button closes it
 * instead of navigating away from the page.
 *
 * Open  → pushes a history entry with { [stateKey]: key } in location.state.
 * Close → navigate(-1) pops that entry; the modal key is gone, isOpen = false.
 *
 * Use the default stateKey ('modal') for page-level modals.
 * Use a different stateKey for Topbar/global modals (e.g. 'chatModal') so
 * they can coexist in location.state with a page modal without overwriting it.
 *
 * Modal state does NOT survive a page reload — that is intentional and
 * acceptable for all Tier 1 modals in this app.
 */
export function useHistoryModal(key, stateKey = 'modal') {
  const navigate = useNavigate()
  const location = useLocation()

  const isOpen = location.state?.[stateKey] === key

  const open = useCallback(() => {
    navigate(location.pathname + location.search, {
      state: { ...location.state, [stateKey]: key },
    })
  }, [navigate, location.pathname, location.search, location.state, stateKey, key])

  const close = useCallback(() => {
    navigate(-1)
  }, [navigate])

  return [isOpen, open, close]
}
