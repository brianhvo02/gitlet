import { existsSync } from "fs";
import { join } from "path";
import { __dirname, createError } from "./util.js";
import { mkdir } from "fs/promises";
import { cwd } from "process";

export default class Repository {
    static PATH = join(cwd(), '.gitlet');

    private constructor() {

    }

    static async open() {
        if (!existsSync(this.PATH))
            createError('Not in an initialized Gitlet directory.');

        return new Repository();
    }

    static async init() {
        if (existsSync(this.PATH))
            createError('A Gitlet version-control system already exists in the current directory.');

        await mkdir(this.PATH, { recursive: true });
        console.log(`Initialized empty Gitlet repository in ${this.PATH}`)
    }
}