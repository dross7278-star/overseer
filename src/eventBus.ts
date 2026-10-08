import { EventEmitter } from "node:events";
import type { StepLog } from "./types";

class EventBus extends EventEmitter {
  publish(taskId: string, log: StepLog): void {
    this.emit(`task:${taskId}`, log);
  }

  subscribe(taskId: string, handler: (log: StepLog) => void): () => void {
    const eventName = `task:${taskId}`;
    this.on(eventName, handler);
    return () => this.off(eventName, handler);
  }
}

export const eventBus = new EventBus();
