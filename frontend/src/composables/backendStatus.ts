import { ref, computed } from 'vue';

/**
 * Global backend-status tracker.
 * Module-level singleton — works outside Vue components.
 *
 * Hook onRequestStart / onRequestDone into the axios instance interceptors.
 * Import overlayVisible / isDown / elapsedSec in App.vue to show the overlay.
 */

let inflightCount = 0;
let startMs = 0;
let tickHandle: ReturnType<typeof setInterval> | null = null;

/** Raw elapsed ms since the oldest unanswered request started. */
const elapsed = ref(0);

/** Flips to true the moment ANY request returns an HTTP response.
 *  Stays true for the rest of the session (backend stays warm).  */
const alive = ref(false);

/** Flips to true when the ticker reaches 60 s without a reply. */
const timedOut = ref(false);

// ─── Internal helpers ───────────────────────────────────────────────────────

function startTick() {
  if (tickHandle !== null) return;
  startMs = Date.now();
  elapsed.value = 0;
  tickHandle = setInterval(() => {
    elapsed.value = Date.now() - startMs;
    if (!timedOut.value && elapsed.value >= 60_000) {
      timedOut.value = true;
    }
  }, 250);
}

function stopTick() {
  if (tickHandle !== null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Call from the axios REQUEST interceptor. */
export function onRequestStart() {
  inflightCount++;
  if (inflightCount === 1) startTick();
}

/**
 * Call from the axios RESPONSE interceptor.
 * @param responded  true  = backend returned an HTTP response (any status code)
 *                   false = network error / timeout (no response at all)
 */
export function onRequestDone(responded: boolean) {
  inflightCount = Math.max(0, inflightCount - 1);

  if (responded) {
    // Backend is alive — clear all state
    alive.value = true;
    timedOut.value = false;
    stopTick();
    elapsed.value = 0;
  } else {
    // Network error
    if (inflightCount === 0) stopTick();
  }
}

// ─── Reactive state consumed by the overlay ─────────────────────────────────

/** Elapsed seconds (for the progress bar / counter display). */
export const elapsedSec = computed(() => elapsed.value / 1000);

/** Show the overlay at all. Appears after 3 s of unresolved requests. */
export const overlayVisible = computed(
  () => !alive.value && (elapsed.value > 3_000 || timedOut.value),
);

/** Backend didn't respond within 60 s → show the "unavailable" message. */
export const isDown = computed(() => timedOut.value && !alive.value);
