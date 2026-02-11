import type { EditorCommand } from "./EditorCommand";

export class CompositeCommand implements EditorCommand {
  label?: string;
  private commands: EditorCommand[];

  constructor(label: string, commands: EditorCommand[] = []) {
    this.label = label;
    this.commands = commands;
  }

  add(cmd: EditorCommand) {
    this.commands.push(cmd);
  }

  get isEmpty() {
    return this.commands.length === 0;
  }

  apply() {
    for (const c of this.commands) c.apply();
  }

  revert() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].revert();
    }
  }
}
