# @primavera-ui/one-time-password Spec

## Example
```html
<OTPContainer mode onSubmit autofocus order auto-submit read-only autocomplete name label onInput>
  <!-- role="group" aria-label={label || "Verification code"} -->
  <OTPInput />  <!-- aria-label="Digit 1 of 6" -->
  <OTPInput />  <!-- aria-label="Digit 2 of 6" -->
  <OTPInput />  <!-- aria-label="Digit 3 of 6" -->
  <span>-</span>
  <OTPInput />  <!-- aria-label="Digit 4 of 6" -->
  <OTPInput />  <!-- aria-label="Digit 5 of 6" -->
  <OTPInput />  <!-- aria-label="Digit 6 of 6" -->
</OTPContainer>
```

## Props
Prop | Type | Default | Description |
|---|---|---|---|
| mode | `"numeric"` \| `"alphanumeric"` | `"numeric"` | Accepted character set |
| on-complete | `(value: string) => void` | - |
| autofocus | `boolean` | `false` | Focus first input on mount |
| order | `"ltr"` \| `"rtl"` | `"ltr"` | Layout and input direction |
| auto-submit | `boolean` | `false` | Call on-complete when last input is filled |
| onInput | `(value: string) => void` | — | Called on every state change with the current value |
| read-only | `boolean` | `false` | Disable all inputs |
| autocomplete | `"one-time-code"` \| `"none"` | `one-time-code` | Forwarded to hidden input |
name | `string` | - | Name attribute for hidden input in form contexts |
| label | `string` | `"Verification code"` | Accessible label for the input group |
| error | `boolean` | `false` | Sets `aria-invalid` and `data-error` for error styling

## Model
1. State contiguous string of characters: [0-9] in `numeric` mode, [a-zA-Z0-9] in `alphanumeric` mode. Illegal characters are silently discarded.
2. Insertion at position N replaces the character at that position. Characters after N are unchanged.
3. Deletion at position N removes that character; characters after N shift back one position. The string remains contiguous.

## UI
1. OTPContainer describes a container on which all configuration is set.
2. OTPInputs describe a single value input, whose position in DOM corresponds to the character value it operates on.
3. Values are shown contiguously across OTPInputs, left-to-right in normal operation, or right-to-left if `order=rtl`.
4. When a character is introduced to a focused OTPInput, its character is inserted at its corresponding position in the state, replacing the previous value if one exists. Succeeding characters are kept in place.
5. When `name` is set, an optional <Input type="hidden" name="`name`"> element provides the entire state to a form, its value stays in sync with the internal state value. `autocomplete` is set on the first visible OTPInput to enable OS-level autofill (e.g. iOS SMS code suggestions, macOS Safari). When `name` is also set, `autocomplete` is forwarded onto the hidden input too. Read-only mode on the OTPContainer applies `read-only` html attributes to all OTPInputs.
6. OTPInputs render as `type="text"`. In numeric mode, `inputmode="numeric"` and `pattern="[0-9]"` are added.
7. OTPContainer can contain many OTPInputs. The count of inputs and is inferred from quantity of nested OTPInputs. A common use case is to put a “-“ in the middle of several inputs. If no OTPInputs are found, the developer should be warned.
8. When a filled input receives focus, its content is selected.
9. Clicking focuses the input. If the clicked input is empty, focus moves to the first empty input.
10. When a filled OTPInput is focused, pressing right arrow on the keyboard focuses on the next input. Right arrow events on empty OTPInputs or final OTPInputs in layout are ignored. This is an intentional, opinionated design decision designed to inform users of the non-contiguous model. Reversed in `rtl` order.
11. When an OTPInput is focused and there are previous inputs, pressing left arrow on the keyboard takes us to the previous input. The keypress is ignored when first input is focused. Reversed in `rtl` order.
12. `on-complete` is called when: (a) auto-submit=true and the last input becomes filled, or (b) `Submit` is pressed with all inputs filled.
13. `Delete` while focused on a filled input causes that char to be removed; subsequent characters shift back one position as per data rules. Focus is moved back to previous input if it exists, otherwise it remains. On an empty input, focus is moved to the previous input, without deleting it.
14. On paste, clipboard text is sanitised character-by-character, before overwriting values, starting at the currently focused input until the end of the clipboard or inputs. Focus will move to last value of pasted input. Remaining clipboard values will be discarded.
15. The parent component is a single tab stop. Tab/Shift+Tab exits.
16. Clear all` resets the component state and focuses the first input.
18. Autofocus prop fires on component mount, focusing on the first OTPInput.
19. When the `error` attribute is set, OTPContainer has `aria-invalid="true"` and the `data-error` attribute for styling. The developer is responsible for displaying error messages and clearing the error state.

## Accessibility
1. OTPContainer has `role="group"` with an `aria-label` (e.g. "Verification code"). An optional `label` prop overrides the default.
2. Each OTPInput has `aria-label` indicating its position (e.g. "Digit 3 of 6").
3. When `read-only` is true, inputs have `aria-readonly="true"`.

## Keyboard actions
Semantic Action | macOS | Windows/Linux |
|---|---|---|
| `Delete` | `Backspace` / `Delete` | `Backspace` / `Delete` |
| `Clear all` | `Cmd+Backspace` | `Ctrl+Backspace` |
| `Move next` | `ArrowRight` | `ArrowRight` |
| `Move previous` | `ArrowLeft` | `ArrowLeft` |
| `Submit` | `Enter` | `Enter` |
| `Focus next element` | `Tab` | `Tab` |
| `Focus previous element` | `Shift+Tab` | `Shift+Tab

## Implementation Notes

1. OTPInputs must NOT use `maxlength` on the underlying `<input>`. OS-level autofill (iOS SMS codes, macOS Safari) fills the entire code into a single input; `maxlength="1"` causes the browser to truncate before the `input` event fires. Instead, omit `maxlength` and handle multi-character input values in the container — when `input.value.length > 1`, distribute characters across slots as if pasted.
