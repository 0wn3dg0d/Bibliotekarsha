export function throttle(fn: any, delay: number) {
  let lastCall = 0;
  let timer: any = null;

  return function (this: any, ...args: any[]) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
