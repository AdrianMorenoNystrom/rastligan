import { createInterface } from "node:readline";
import { Writable } from "node:stream";

export function validateEditorCode(code) {
  if (Array.from(code).length < 16 || Buffer.byteLength(code, "utf8") > 72) {
    throw new Error("Koden måste ha minst 16 tecken och högst 72 byte.");
  }
}

export function readHiddenCode(
  prompt,
  { input = process.stdin, output = process.stdout } = {},
) {
  if (!input.isTTY) {
    throw new Error(
      "Kör kodbytet i en interaktiv terminal. Koden anges dolt där.",
    );
  }
  // Readline handles editing and raw mode; its output and history stay disabled.
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const rl = createInterface({
    input,
    output: silent,
    terminal: true,
    historySize: 0,
  });
  output.write(prompt);
  return new Promise((resolve, reject) => {
    let finished = false;
    const cancel = () => {
      if (finished) return;
      finished = true;
      output.write("\n");
      rl.close();
      reject(new Error("Kodbytet avbröts. Ingen kod har ändrats."));
    };
    rl.on("SIGINT", cancel);
    rl.on("close", cancel);
    rl.question("", (code) => {
      finished = true;
      output.write("\n");
      rl.close();
      resolve(code);
    });
  });
}

export async function chooseEditorCode(ask = readHiddenCode) {
  const code = await ask("Ny kod (visas inte): ");
  validateEditorCode(code);
  const repeated = await ask("Upprepa koden: ");
  if (code !== repeated) {
    throw new Error("Koderna stämmer inte överens. Ingen kod har ändrats.");
  }
  return code;
}
