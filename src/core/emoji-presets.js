export const EMOJI_PRESETS = Object.freeze({
  blink: Object.freeze({
    hearts: Object.freeze({ label: "爱心", caption: "发射爱心", emojis: Object.freeze(["💗", "❤️", "💕"]) }),
    sparkles: Object.freeze({ label: "闪耀", caption: "洒出星光", emojis: Object.freeze(["✨", "🌟", "💫"]) }),
    party: Object.freeze({ label: "派对", caption: "开始庆祝", emojis: Object.freeze(["🎉", "🥳", "🎊"]) }),
  }),
  mouth: Object.freeze({
    poop: Object.freeze({ label: "搞怪", caption: "喷出便便", emojis: Object.freeze(["💩", "💩", "💨"]) }),
    rainbow: Object.freeze({ label: "彩虹", caption: "吐出彩虹", emojis: Object.freeze(["🌈", "🫧", "✨"]) }),
    fire: Object.freeze({ label: "火焰", caption: "喷出火焰", emojis: Object.freeze(["🔥", "🌶️", "🔥"]) }),
  }),
});

export const DEFAULT_EMOJI_SELECTION = Object.freeze({
  blink: "hearts",
  mouth: "poop",
});

export function normalizeEmojiSelection(candidate = {}) {
  const safeCandidate = candidate && typeof candidate === "object" ? candidate : {};
  return {
    blink: EMOJI_PRESETS.blink[safeCandidate.blink] ? safeCandidate.blink : DEFAULT_EMOJI_SELECTION.blink,
    mouth: EMOJI_PRESETS.mouth[safeCandidate.mouth] ? safeCandidate.mouth : DEFAULT_EMOJI_SELECTION.mouth,
  };
}

export function emojiSetFor(kind, preset) {
  return EMOJI_PRESETS[kind]?.[preset]?.emojis ?? [];
}
