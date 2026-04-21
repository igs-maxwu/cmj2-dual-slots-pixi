import { Application, Container } from 'pixi.js';

/**
 * Minimal screen lifecycle.
 *
 * Each Screen owns one Container. `onMount` adds it to the stage and wires
 * listeners; `onUnmount` must remove & destroy everything it created. No
 * framework magic — transitions are a plain `await unmount(); mount(next)`.
 */
export interface Screen {
  onMount(app: Application, stage: Container): void | Promise<void>;
  onUnmount(): void | Promise<void>;
}

export class ScreenManager {
  private current: Screen | null = null;
  private stage: Container;

  constructor(private app: Application) {
    this.stage = new Container();
    this.app.stage.addChild(this.stage);
  }

  async show(next: Screen): Promise<void> {
    if (this.current) {
      await this.current.onUnmount();
      this.stage.removeChildren();
    }
    this.current = next;
    await next.onMount(this.app, this.stage);
  }
}
