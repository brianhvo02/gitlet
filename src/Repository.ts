import { existsSync } from "fs";
import { join } from "path";
import { __dirname, createError, sha1 } from "./util.js";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { cwd } from "process";
import Commit, { Files } from "./Commit.js";


export default class Repository {
    static DIRECTORY_PATH = join(cwd(), process.env.DEBUG ? 'test_proj' : '');
    static GITLET_PATH = join(this.DIRECTORY_PATH, '.gitlet');
    static HEAD_PATH = join(this.GITLET_PATH, 'HEAD');
    static COMMITS_PATH = join(this.GITLET_PATH, 'commits');
    static STAGING_PATH = join(this.GITLET_PATH, 'staging');
    static OBJECTS_PATH = join(this.GITLET_PATH, 'objects');
    static BRANCHES_PATH = join(this.GITLET_PATH, 'branches');

    head;
    headHash;
    headCommit;

    private constructor(head: string, headHash: string, headCommit: Commit) {
        this.head = head;
        this.headHash = headHash;
        this.headCommit = headCommit;
    }

    static async open() {
        if (!existsSync(this.GITLET_PATH))
            createError('Not in an initialized Gitlet directory.');

        const head = await readFile(this.HEAD_PATH, { encoding: 'utf-8' });
        const headHash = await readFile(join(this.BRANCHES_PATH, head), { encoding: 'utf-8' });
        const headCommit = await readFile(join(this.BRANCHES_PATH, headHash), { encoding: 'utf-8' });
        return new Repository(head, await Commit.read(this.COMMITS_PATH, head));
    }

    static async init() {
        if (existsSync(this.GITLET_PATH))
            createError('A Gitlet version-control system already exists in the current directory.');

        await mkdir(this.COMMITS_PATH, { recursive: true });
        await mkdir(this.STAGING_PATH, { recursive: true });
        await mkdir(this.OBJECTS_PATH, { recursive: true });
        await mkdir(this.BRANCHES_PATH, { recursive: true });
        
        const initialCommit = new Commit({
            timestamp: 0, 
            message: 'initial commit',
            files: {}
        });
        const serial = initialCommit.serialize();
        const hash = sha1(serial);
        await writeFile(join(this.COMMITS_PATH, hash), serial);
        await writeFile(this.HEAD_PATH, 'main');
        await writeFile(join(this.BRANCHES_PATH, 'main'), hash);
        
        console.log(`Initialized empty Gitlet repository in ${this.GITLET_PATH}.`)
    }

    async add(filename: string) {
        const filePath = join(Repository.DIRECTORY_PATH, filename);
        if (!existsSync(filePath))
            createError('File does not exist.');

        const stagedFilePath = join(Repository.STAGING_PATH, filename);

        const [file, stagedFile] = await Promise.all([
            readFile(filePath), 
            existsSync(stagedFilePath) ? readFile(stagedFilePath) : null
        ]);

        if (sha1(file) !== this.headCommit.files[filename]) {
            return await writeFile(join(Repository.STAGING_PATH, filename), file);
        }

        if (stagedFile)
            await rm(stagedFilePath);
    }

    async commit(message: string) {
        // const files = await readdir(Repository.STAGING_PATH, { withFileTypes: true })
        //     .then(entries => entries.reduce((filenames: string[], entry) => [
        //         ...filenames,
        //         ...(entry.isFile() ? [entry.name] : [])
        //     ], []));

        const stagingFiles = await readdir(Repository.STAGING_PATH);

        if (!stagingFiles.length)
            createError('No changes added to the commit.');

        if (!message)
            createError('Please enter a commit message.');

        const files = { ...this.headCommit.files };

        for (const filename of stagingFiles) {
            const filepath = join(Repository.STAGING_PATH, filename);
            if (filename.includes('[REMOVE]')) {
                delete files[filename.slice(9)];
            } else {
                const file = await readFile(filepath);
                const hash = sha1(file);
                await writeFile(join(Repository.OBJECTS_PATH, hash), file);
                files[filename] = hash;
            }
            await rm(filepath);
        }
        
        const newCommit = new Commit({
            timestamp: new Date(), 
            message,
            files,
            parent1: this.head
        });
        const serial = newCommit.serialize();
        const hash = sha1(serial);

        await writeFile(join(Repository.COMMITS_PATH, hash), serial);
        await writeFile(join(Repository.HEAD_PATH), hash);

        this.head = hash;
        this.headCommit = newCommit;
    }

    async rm(filename: string) {
        const stagedFilepath = join(Repository.STAGING_PATH, filename);
        if (!existsSync(stagedFilepath) && !this.headCommit.files[filename]) {
            createError('No reason to remove the file.');
        }

        if (existsSync(stagedFilepath)) {
            await rm(stagedFilepath);
        }

        if (this.headCommit.files[filename]) {
            await writeFile(join(Repository.STAGING_PATH, `[REMOVE] ${filename}`), '');
            const filepath = join(Repository.DIRECTORY_PATH, filename);
            if (existsSync(filepath))
                await rm(filepath);
        }
    }

    async log(hash?: string) {
        hash ??= this.head;
        const commit = await Commit.read(Repository.COMMITS_PATH, hash);
        console.log(
`===
commit ${hash}
Date: ${commit.timestamp.toString()}
${commit.message}
`
        );

        if (commit.parent1)
            this.log(commit.parent1);
    }
}