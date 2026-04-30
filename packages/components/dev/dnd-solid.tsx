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
      expandable
      autofocus
    >
      {(item, expanded) => (
        <div style={{ padding: "8px 12px", "box-sizing": "border-box" }}>
          <div>{item().label}</div>
          {expanded() && (
            <div style={{ "margin-top": "8px", color: "#666", "font-size": "13px" }}>
              <div>Expanded body for {item().label}.</div>
              <div>Double-click to collapse, or press Escape.</div>
              <div>Items below are pushed down by the extra height.</div>
            </div>
          )}
        </div>
      )}
    </Dnd>
  );
}

render(() => <App />, document.getElementById("root")!);
