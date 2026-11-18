import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { createMockServices } from '@/services/mock'
import { canvasArtworkExporter } from '@/services/real/canvasArtworkExporter'
import { chladniPatternMapper } from '@/services/real/chladniPatternMapper'
import { galleryService } from '@/services/real/galleryService'
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
      artworkExporter: canvasArtworkExporter,
      galleryService,
      ...services,
    }),
    [services],
  )
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
}
