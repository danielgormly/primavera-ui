import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { Dnd } from "../src/dnd/solid";

type Item = { id: string; label: string };

const initial: Item[] = Array.from({ length: 50 }, (_, i) => ({
  id: String(i + 1),
  label: `Item ${i + 1}`,
}));

function App() {
  const [items, setItems] = createSignal<Item[]>(initial);

  return (
    <Dnd
      items={items()}
      setItems={setItems}
      getKey={(i) => i.id}
      itemHeight={40}
      autofocus
    >
      {(item) => <span>{item().label}</span>}
    </Dnd>
  );
}

render(() => <App />, document.getElementById("root")!);
