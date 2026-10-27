import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import {
  chooseEditorCode,
  readHiddenCode,
  validateEditorCode,
} from "../scripts/admin-code.mjs";

test("egen kod kan ha valfri längd, inklusive en enda siffra", () => {
  assert.doesNotThrow(() => validateEditorCode("7"));
  assert.doesNotThrow(() => validateEditorCode("1234"));
  assert.doesNotThrow(() => validateEditorCode("å🎾".repeat(10000)));
  assert.doesNotThrow(() => validateEditorCode("a".repeat(100000)));
});

test("tom eller saknad kod nekas", () => {
  for (const code of ["", null, undefined])
    assert.throws(() => validateEditorCode(code), /Ange en kod/);
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
    /PowerShell eller Windows Terminal/,
  );
});

test("terminalinmatning visar stjärnor utan att röja koden", async () => {
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
  assert.equal(
    displayed,
    "Kod: " + "*".repeat(Array.from("egen-hemlig-testkod-123").length) + "\n",
  );
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
  assert.equal(
    displayed,
    "Kod: " + "*".repeat(Array.from("hemlig-påbörjad-kod").length) + "\n",
  );
});

test("backsteg fungerar för siffror och Unicode och terminalen återställs", async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (raw) => {
    input.isRaw = raw;
    return input;
  };
  const output = new PassThrough();
  let displayed = "";
  output.on("data", (chunk) => {
    displayed += chunk.toString();
  });
  const answer = readHiddenCode("Kod: ", { input, output });
  assert.equal(input.isRaw, true);
  input.write("1🎾\x7f2\r\n");
  assert.equal(await answer, "12");
  assert.equal(displayed, "Kod: **\b \b*\n");
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount("keypress"), 0);
  assert.equal(input.isPaused(), true);
});

test("båda kodfrågorna tar emot maskerad inmatning", async () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  const output = new PassThrough();
  let displayed = "";
  output.on("data", (chunk) => {
    displayed += chunk.toString();
  });
  const answer = chooseEditorCode((prompt) =>
    readHiddenCode(prompt, { input, output }),
  );
  input.write("7\r");
  await new Promise((resolve) => setImmediate(resolve));
  input.write("7\r");
  assert.equal(await answer, "7");
  assert.equal(displayed, "Ny kod (visas som *): *\nUpprepa koden: *\n");
});
