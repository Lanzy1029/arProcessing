import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EMOJI_SELECTION,
  EMOJI_PRESETS,
  emojiSetFor,
  normalizeEmojiSelection,
} from "../src/core/emoji-presets.js";

test("v2 defaults to heart blinks and poop mouth effects", () => {
  assert.deepEqual(DEFAULT_EMOJI_SELECTION, { blink: "hearts", mouth: "poop" });
  assert.ok(emojiSetFor("blink", "hearts").includes("❤️"));
  assert.ok(emojiSetFor("mouth", "poop").includes("💩"));
});

test("emoji selection accepts known presets", () => {
  assert.deepEqual(normalizeEmojiSelection({ blink: "party", mouth: "rainbow" }), {
    blink: "party",
    mouth: "rainbow",
  });
  assert.equal(EMOJI_PRESETS.blink.party.caption, "开始庆祝");
  assert.equal(EMOJI_PRESETS.mouth.rainbow.caption, "吐出彩虹");
});

test("invalid or saved legacy choices safely return to v2 defaults", () => {
  assert.deepEqual(normalizeEmojiSelection({ blink: "laser", mouth: "cloud" }), {
    blink: "hearts",
    mouth: "poop",
  });
  assert.deepEqual(normalizeEmojiSelection(null), {
    blink: "hearts",
    mouth: "poop",
  });
});
