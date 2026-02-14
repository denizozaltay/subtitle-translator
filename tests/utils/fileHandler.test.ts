import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { readFile, writeFile, fileExists } from "../../src/utils/fileHandler";

describe("fileHandler", () => {
  let tempDir: string;
  let tempFile: string;

  afterEach(() => {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  function setupTempFile(content: string): void {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "subtitle-test-"));
    tempFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(tempFile, content, "utf-8");
  }

  describe("readFile", () => {
    it("reads file content", () => {
      setupTempFile("hello world");
      assert.strictEqual(readFile(tempFile), "hello world");
    });

    it("reads utf-8 content", () => {
      setupTempFile("Merhaba dünya çeşitli ğüşöç");
      assert.strictEqual(readFile(tempFile), "Merhaba dünya çeşitli ğüşöç");
    });

    it("throws for non-existent file", () => {
      assert.throws(() => readFile("/tmp/nonexistent-test-file.txt"));
    });
  });

  describe("writeFile", () => {
    it("writes content to file", () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "subtitle-test-"));
      tempFile = path.join(tempDir, "output.txt");
      writeFile(tempFile, "test content");
      assert.strictEqual(fs.readFileSync(tempFile, "utf-8"), "test content");
    });

    it("overwrites existing file", () => {
      setupTempFile("old content");
      writeFile(tempFile, "new content");
      assert.strictEqual(fs.readFileSync(tempFile, "utf-8"), "new content");
    });
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      setupTempFile("exists");
      assert.strictEqual(fileExists(tempFile), true);
    });

    it("returns false for non-existent file", () => {
      assert.strictEqual(fileExists("/tmp/nonexistent-test-file.txt"), false);
    });
  });
});
