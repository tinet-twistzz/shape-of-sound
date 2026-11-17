import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { copy } from '@/content/copy'
import type { InputMode } from '@/types/domain'

export interface InputModeSwitchProps {
  value: InputMode
  onChange: (mode: InputMode) => void
  className?: string
}

const OPTIONS = [
  { value: 'slider', label: copy.sections.studio.inputModeSlider },
  { value: 'mic', label: copy.sections.studio.inputModeMic },
] as const

/** 输入方式切换：滑动调音 / 麦克风哼唱 */
export function InputModeSwitch({ value, onChange, className }: InputModeSwitchProps) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel={copy.sections.studio.inputModeAria}
      className={className}
    />
  )
}
