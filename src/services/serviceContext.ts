import { createContext, useContext } from 'react'

import type { Services } from '@/types/services'

export const ServiceContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = useContext(ServiceContext)
  if (!services) {
    throw new Error('useServices must be used within a ServiceProvider')
  }
  return services
}
