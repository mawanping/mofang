/** 表情符号扩展：:rocket: :+1: :-1: 等 */
const EMOJI: Record<string, string> = {
  rocket: '🚀', tada: '🎉', '+1': '👍', '-1': '👎', smile: '😄',
  heart: '❤️', fire: '🔥', star: '⭐', warning: '⚠️', bulb: '💡',
  book: '📖', pencil: '✏️', memo: '📝', link: '🔗', lock: '🔒',
  key: '🔑', mag: '🔍', calendar: '📅', chart: '📈', money: '💰',
  coffee: '☕', computer: '💻', phone: '📱', email: '📧', bell: '🔔',
  check: '✅', x: '❌', arrow_right: '➡️', arrow_up: '⬆️', zap: '⚡',
  sparkles: '✨', eyes: '👀', brain: '🧠', muscle: '💪', clap: '👏',
  pray: '🙏', wave: '👋', point_right: '👉', point_down: '👇',
}

const RE = /^:([a-z0-9_+-]+):/

export function markedEmoji(): { extensions: unknown[] } {
  return {
    extensions: [
      {
        name: 'emoji',
        level: 'inline',
        start(src: string) {
          const i = src.indexOf(':')
          return i === -1 ? undefined : i
        },
        tokenizer(src: string) {
          const m = RE.exec(src)
          if (!m) return undefined
          const ch = EMOJI[m[1]]
          if (!ch) return undefined
          return { type: 'emoji', raw: m[0], text: ch }
        },
        renderer(token: { text?: string }) {
          return `<span class="md-emoji">${token.text ?? ''}</span>`
        },
      },
    ],
  }
}

export const EMOJI_MAP = EMOJI
