export interface EditorCommand {
  apply(): void;
  revert(): void;
  label?: string; // optional, nice for UI later
}
