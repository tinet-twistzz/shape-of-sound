import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { createMockServices } from '@/services/mock'
import { ServiceContext } from '@/services/serviceContext'
import type { Services } from '@/types/services'

interface ServiceProviderProps {
  services?: Partial<Services>
  children: ReactNode
}

export function ServiceProvider({ services, children }: ServiceProviderProps) {
  const value = useMemo<Services>(() => ({ ...createMockServices(), ...services }), [services])
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
}
