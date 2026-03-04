import type { Key, TxnId, DndOp, DndSourceArgs } from "./dnd-types";

let txnCounter = 0;

export class DndSource<T> {
  private _getKey: (item: T) => Key;
  private _getOrderFn: () => readonly Key[];
  private _getItemFn: (key: Key) => T | undefined;

  private cachedOrder: Key[];
  private previewOrder: Key[] | null = null;
  private pendingTxns = new Map<
    TxnId,
    { ops: DndOp<T>[]; previewOrder: Key[] }
  >();
  private changeListeners = new Set<(op: DndOp<T>, txnId: TxnId) => void>();

  constructor(args: DndSourceArgs<T>) {
    this._getKey = args.getKey;
    this._getOrderFn = args.getOrder;
    this._getItemFn = args.getItem;
    this.cachedOrder = [...args.getOrder()];
  }

  getKey(item: T): Key {
    return this._getKey(item);
  }

  getOrder(): readonly Key[] {
    return this.previewOrder ?? this.cachedOrder;
  }

  getItem(key: Key): T | undefined {
    return this._getItemFn(key);
  }

  /** Host calls this to apply external updates to the list. */
  apply(ops: DndOp<T>[]): TxnId {
    const txnId = this.generateTxnId();
    let order = [...this.cachedOrder];
    for (const op of ops) {
      order = this.applyOpToOrder(order, op);
    }
    this.pendingTxns.set(txnId, { ops, previewOrder: order });
    return txnId;
  }

  /** Register a listener for committed changes. Returns unsubscribe function. */
  onChange(cb: (op: DndOp<T>, txnId: TxnId) => void): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  /** Optimistic UI update — getOrder() will return the preview order. */
  _commitUI(txnId: TxnId): void {
    const txn = this.pendingTxns.get(txnId);
    if (!txn) return;
    this.previewOrder = txn.previewOrder;
  }

  /** Commit changes to host state. Notifies onChange listeners. */
  _commitState(txnId: TxnId): void {
    const txn = this.pendingTxns.get(txnId);
    if (!txn) return;
    this.cachedOrder = txn.previewOrder;
    this.previewOrder = null;
    this.pendingTxns.delete(txnId);
    for (const op of txn.ops) {
      for (const cb of this.changeListeners) {
        cb(op, txnId);
      }
    }
  }

  /** Rollback a pending transaction. */
  _rollback(txnId: TxnId): void {
    this.pendingTxns.delete(txnId);
    this.previewOrder = null;
  }

  /** Sync cached order from external source (e.g. after host processes changes). */
  syncOrder(): void {
    this.cachedOrder = [...this._getOrderFn()];
    if (!this.previewOrder) {
      // no pending preview, just update
    }
  }

  private generateTxnId(): TxnId {
    return `txn_${++txnCounter}`;
  }

  private applyOpToOrder(order: Key[], op: DndOp<T>): Key[] {
    switch (op.type) {
      case "move": {
        const keySet = new Set(op.keys);
        const filtered = order.filter((k) => !keySet.has(k));
        if (op.beforeKey === null) {
          return [...filtered, ...op.keys];
        }
        const idx = filtered.indexOf(op.beforeKey);
        if (idx === -1) return [...filtered, ...op.keys];
        filtered.splice(idx, 0, ...op.keys);
        return filtered;
      }
      case "insert": {
        const newKeys = op.items.map((item) => this._getKey(item));
        if (op.beforeKey === null) {
          return [...order, ...newKeys];
        }
        const idx = order.indexOf(op.beforeKey);
        if (idx === -1) return [...order, ...newKeys];
        const result = [...order];
        result.splice(idx, 0, ...newKeys);
        return result;
      }
      case "remove": {
        const keySet = new Set(op.keys);
        return order.filter((k) => !keySet.has(k));
      }
      case "reset": {
        return op.keys;
      }
      case "update": {
        // Update doesn't change order
        return order;
      }
    }
  }
}
