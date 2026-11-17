import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

export type ToastFn = (message: string, tone?: ToastTone) => void

export const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
  const toast = useContext(ToastContext)
  if (!toast) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return toast
}
