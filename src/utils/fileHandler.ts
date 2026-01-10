import * as fs from "fs";
import * as path from "path";

export function readFile(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  return fs.readFileSync(absolutePath, "utf-8");
}

export function writeFile(filePath: string, content: string): void {
  const absolutePath = path.resolve(filePath);
  fs.writeFileSync(absolutePath, content, "utf-8");
}

export function fileExists(filePath: string): boolean {
  const absolutePath = path.resolve(filePath);
  return fs.existsSync(absolutePath);
}
