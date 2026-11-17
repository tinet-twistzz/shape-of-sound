import type { AudioEngine } from '@/types/services'

// TODO: 替换为 Web Audio 实现（OscillatorNode / 采样播放）
export const mockAudioEngine: AudioEngine = {
  play(sound) {
    console.log('[MockAudioEngine] play', sound.id, `${sound.frequencyHz}Hz`)
  },
  playTone(frequencyHz) {
    console.log('[MockAudioEngine] playTone', `${frequencyHz}Hz`)
  },
  stop() {
    console.log('[MockAudioEngine] stop')
  },
  setMuted(muted) {
    console.log('[MockAudioEngine] setMuted', muted)
  },
}
