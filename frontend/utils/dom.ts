import { throttle } from './throttle';

export function observeThrottled(doc: Document, callback: () => void, delay = 200): () => void {
  const throttled = throttle(callback, delay);
  const observer = new MutationObserver(throttled);
  if (doc.body) {
    observer.observe(doc.body, { childList: true, subtree: true });
  }
  throttled();
  return () => observer.disconnect();
}
