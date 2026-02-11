// occupancy.ts
export class GridOccupancy<T = unknown> implements OccupancyView<T> {
  private map = new Map<string, T>();

  has(gx: number, gy: number): boolean {
    return this.map.has(`${gx},${gy}`);
  }

  set(gx: number, gy: number, item: T): void {
    this.map.set(`${gx},${gy}`, item);
  }

  delete(gx: number, gy: number): void {
    this.map.delete(`${gx},${gy}`);
  }

  get(gx: number, gy: number): T | undefined {
    return this.map.get(`${gx},${gy}`);
  }

  clear(): void {
    this.map.clear();
  }

  values(): IterableIterator<T> {
    return this.map.values();
  }
}

// occupancyTypes.ts
export interface OccupancyView<T> {
  has(gx: number, gy: number): boolean;
  get(gx: number, gy: number): T | undefined;
  set(gx: number, gy: number, item: T): void;
  delete(gx: number, gy: number): void;
  values(): IterableIterator<T>;
}
