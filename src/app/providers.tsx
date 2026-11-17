import type { ReactNode } from 'react'

import { ToastProvider } from '@/components/ui/Toast'
import { ServiceProvider } from '@/services/ServiceProvider'
import { AppStateProvider } from '@/store/AppStateProvider'
import type { Services } from '@/types/services'

interface AppProvidersProps {
  services?: Partial<Services>
  children: ReactNode
}

export function AppProviders({ services, children }: AppProvidersProps) {
  return (
    <ServiceProvider services={services}>
      <AppStateProvider>
        <ToastProvider>{children}</ToastProvider>
      </AppStateProvider>
    </ServiceProvider>
  )
}
