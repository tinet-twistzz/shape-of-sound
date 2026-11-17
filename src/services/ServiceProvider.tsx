import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { createMockServices } from '@/services/mock'
import { chladniPatternMapper } from '@/services/real/chladniPatternMapper'
import { webAudioEngine } from '@/services/real/webAudioEngine'
import { webMicInput } from '@/services/real/webMicInput'
import { ServiceContext } from '@/services/serviceContext'
import type { Services } from '@/types/services'

interface ServiceProviderProps {
  services?: Partial<Services>
  children: ReactNode
}

export function ServiceProvider({ services, children }: ServiceProviderProps) {
  const value = useMemo<Services>(
    () => ({
      ...createMockServices(),
      audioEngine: webAudioEngine,
      micInput: webMicInput,
      patternMapper: chladniPatternMapper,
      ...services,
    }),
    [services],
  )
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
}
