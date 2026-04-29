import { register, DndSource } from "../src/dnd";
register();

type Item = { key: string; label: string };

const items: Item[] = Array.from({ length: 50 }, (_, i) => ({
  key: String(i + 1),
  label: `Item ${i + 1}`,
}));
const keyIndex = new Map(items.map((i) => [i.key, i]));

const source = new DndSource<Item>({
  getKey: (item) => item.key,
  getOrder: () => items.map((i) => i.key),
  getItem: (key) => keyIndex.get(key),
});

source.onChange((op) => {
  if (op.type !== "move") return;
  const moved = op.keys.map((k) => keyIndex.get(k)!);
  for (const k of op.keys) {
    const idx = items.findIndex((i) => i.key === k);
    if (idx !== -1) items.splice(idx, 1);
  }
  if (op.beforeKey === null) {
    items.push(...moved);
  } else {
    const idx = items.findIndex((i) => i.key === op.beforeKey);
    if (idx !== -1) items.splice(idx, 0, ...moved);
    else items.push(...moved);
  }
  source.syncOrder();
});

const renderer = {
  mount(_key: string, item: Item, container: HTMLElement) {
    container.textContent = item.label;
    return () => { container.textContent = ""; };
  },
};

const el = document.querySelector<HTMLElement>("#dnd")!;
(el as any).setSource(source);
(el as any).setRenderer(renderer);
