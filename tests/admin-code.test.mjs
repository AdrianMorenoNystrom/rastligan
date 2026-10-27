import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import {
  chooseEditorCode,
  readHiddenCode,
  validateEditorCode,
} from "../scripts/admin-code.mjs";

test("egen kod följer databasens minimilängd och bcrypts bytegräns", () => {
  assert.throws(() => validateEditorCode("kort"));
  assert.doesNotThrow(() => validateEditorCode("a".repeat(16)));
  assert.doesNotThrow(() => validateEditorCode("a".repeat(72)));
  assert.throws(() => validateEditorCode("a".repeat(73)));
  assert.doesNotThrow(() => validateEditorCode("å".repeat(36)));
  assert.throws(() => validateEditorCode("å".repeat(37)));
});

test("egen kod måste bekräftas innan den returneras för sparande", async () => {
  const code = "valfri-testkod-12345";
  const answers = [code, code];
  assert.equal(await chooseEditorCode(async () => answers.shift()), code);
});

test("olika koder avbryter utan att röja dem i felet", async () => {
  const codes = ["valfri-testkod-12345", "annan-testkod-67890"];
  const answers = [...codes];
  await assert.rejects(
    chooseEditorCode(async () => answers.shift()),
    (error) => {
      assert.match(error.message, /stämmer inte överens/);
      codes.forEach((code) => assert.ok(!error.message.includes(code)));
      return true;
    },
  );
});

test("kod kan inte skickas genom vanlig stdin", () => {
  assert.throws(
    () =>
      readHiddenCode("Kod: ", {
        input: new PassThrough(),
        output: new PassThrough(),
      }),
    /interaktiv terminal/,
  );
});

test("terminalinmatning skriver aldrig ut kod eller stjärnor", async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  const output = new PassThrough();
  let displayed = "";
  output.on("data", (chunk) => {
    displayed += chunk.toString();
  });
  const answer = readHiddenCode("Kod: ", { input, output });
  input.write("egen-hemlig-testkod-123\r");
  assert.equal(await answer, "egen-hemlig-testkod-123");
  assert.equal(displayed, "Kod: \n");
});

test("Ctrl+C avbryter kodinmatning utan att röja kod", async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  const output = new PassThrough();
  let displayed = "";
  output.on("data", (chunk) => {
    displayed += chunk.toString();
  });
  const answer = readHiddenCode("Kod: ", { input, output });
  input.write("hemlig-påbörjad-kod\x03");
  await assert.rejects(answer, /avbröts/);
  assert.equal(displayed, "Kod: \n");
});
