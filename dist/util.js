import { createHash } from "crypto";
import { fileURLToPath } from "url";
export const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const createError = (err) => {
    console.error(err);
    process.exit(0);
};
export const sha1 = (input) => {
    const hash = createHash('sha1');
    hash.update(input);
    return hash.digest('hex');
};
export const log = (output) => console.log(output);
export const strComp = (a, b) => a.localeCompare(b);
