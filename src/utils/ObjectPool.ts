export class ObjectPool<T> {
  private readonly available: T[] = [];

  constructor(private readonly factory: () => T, initialSize: number) {
    for (let i = 0; i < initialSize; i += 1) this.available.push(factory());
  }

  acquire(): T {
    return this.available.pop() ?? this.factory();
  }

  release(item: T): void {
    this.available.push(item);
  }
}
