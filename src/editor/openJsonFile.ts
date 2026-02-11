export function openJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result as string));
        } catch {
          resolve(null);
        }
      };

      reader.readAsText(file);
    };

    input.click();
  });
}
