import type { Services } from '@/types/services'

import { mockArtworkExporter } from './mockArtworkExporter'
import { mockAudioEngine } from './mockAudioEngine'
import { mockDataSource } from './mockDataSource'
import { createMockGalleryService } from './mockGalleryService'
import { createMockMicInput } from './mockMicInput'
import { mockPatternMapper } from './mockPatternMapper'
import { mockQuizService } from './mockQuizService'

export function createMockServices(): Services {
  return {
    dataSource: mockDataSource,
    audioEngine: mockAudioEngine,
    micInput: createMockMicInput(),
    quizService: mockQuizService,
    patternMapper: mockPatternMapper,
    artworkExporter: mockArtworkExporter,
    galleryService: createMockGalleryService(),
  }
}
