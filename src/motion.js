/**
 * Decides which entrance animations a render should play, from how the view state
 * changed since the previous render. Every render rebuilds the DOM (replaceChildren),
 * so a CSS animation on a new node replays unless it is gated here.
 *
 * @param {{ preview: number, isPreview: boolean } | null} prev previous render's view state, null on boot
 * @param {{ preview: number, isPreview: boolean }} next
 * @returns {{ swap: boolean, dockEnter: boolean }}
 */
export function motionPlan(prev, next) {
  if (prev === null) return { swap: false, dockEnter: false };
  return {
    swap: next.preview !== prev.preview,
    dockEnter: next.isPreview && !prev.isPreview,
  };
}
