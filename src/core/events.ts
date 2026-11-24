type Handler<T> = (payload: T) => void;

/**
 * Minimal typed publish/subscribe. The simulation emits events; the UI subscribes.
 * This keeps src/sim free of any DOM or presentation code.
 */
export class EventBus<Events extends object> {
  private readonly handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  /** Subscribes and returns an unsubscribe function. */
  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const list = (this.handlers[type] ??= []);
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.handlers[type];
    if (!list) return;
    for (const handler of [...list]) handler(payload);
  }
}
