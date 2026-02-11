export interface EditorCommand {
  label?: string;
  apply(): void;
  revert(): void;
}
