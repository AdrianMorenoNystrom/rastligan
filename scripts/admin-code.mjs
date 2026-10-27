import { emitKeypressEvents } from "node:readline";

export function validateEditorCode(code) {
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Ange en kod.");
  }
}

export function readHiddenCode(
  prompt,
  { input = process.stdin, output = process.stdout } = {},
) {
  if (!input.isTTY) {
    throw new Error(
      "Kör kodbytet i PowerShell eller Windows Terminal. Koden visas som stjärnor.",
    );
  }
  const wasRaw = Boolean(input.isRaw);
  const shouldPause = input.readableFlowing !== true;
  emitKeypressEvents(input);
  return new Promise((resolve, reject) => {
    let finished = false;
    const characters = [];
    const finish = (cancelled = false) => {
      if (finished) return;
      finished = true;
      input.removeListener("keypress", onKeypress);
      input.removeListener("end", cancel);
      input.removeListener("error", cancel);
      input.setRawMode?.(wasRaw);
      if (shouldPause) input.pause();
      output.write("\n");
      const code = characters.join("");
      characters.length = 0;
      if (cancelled)
        reject(new Error("Kodbytet avbröts. Ingen kod har ändrats."));
      else resolve(code);
    };
    const cancel = () => finish(true);
    const onKeypress = (text, key = {}) => {
      if (finished) return;
      if (key.ctrl && (key.name === "c" || key.name === "d")) return cancel();
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") {
        if (characters.length) {
          characters.pop();
          output.write("\b \b");
        }
        return;
      }
      if (key.ctrl || key.meta || !text || text.startsWith("\x1b")) return;
      const added = Array.from(text);
      characters.push(...added);
      output.write("*".repeat(added.length));
    };
    input.on("keypress", onKeypress);
    input.once("end", cancel);
    input.once("error", cancel);
    input.setRawMode?.(true);
    input.resume();
    output.write(prompt);
  });
}

export async function chooseEditorCode(ask = readHiddenCode) {
  const code = await ask("Ny kod (visas som *): ");
  validateEditorCode(code);
  const repeated = await ask("Upprepa koden: ");
  if (code !== repeated) {
    throw new Error("Koderna stämmer inte överens. Ingen kod har ändrats.");
  }
  return code;
}
