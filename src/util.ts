import { fileURLToPath } from "url";

export const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const createError = (err: string) => {
    console.error(err);
    process.exit(0);
}