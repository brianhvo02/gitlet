import { createHash } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";

export const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const createError = (err: string) => {
    console.error(err);
    process.exit(0);
}

export const sha1 = (input: string | Buffer) => {
    const hash = createHash('sha1');
    hash.update(input);
    return hash.digest('hex');
}

export const log = (output: any) => console.log(output);

export const strComp = (a: string, b: string) => a.localeCompare(b);