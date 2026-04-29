export type Key = string | number;

export type TxnId = string;

export type DndOp<T = any> =
  | { type: "move"; keys: Key[]; beforeKey: Key | null }
  | { type: "insert"; items: T[]; beforeKey: Key | null }
  | { type: "remove"; keys: Key[] }
  | { type: "update"; key: Key; patch: any }
  | { type: "reset"; keys: Key[] };

export type Block = {
  anchor: Key;
  to: Key;
};

export type Selection = {
  blocks: Block[];
  active: Block | null;
};

export interface DndSourceArgs<T> {
  getKey: (item: T) => Key;
  getOrder: () => readonly Key[];
  getItem: (key: Key) => T | undefined;
}

export interface DndRenderer<T> {
  mount(key: Key, item: T, container: HTMLElement): () => void;
  getNativeDropData?(
    keys: Key[],
    items: T[],
  ): Array<{ type: string; data: string }>;
}

export interface DragContext {
  register(renderer: DndRenderer<any>, source: any): void;
}
