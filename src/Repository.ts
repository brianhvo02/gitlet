import { existsSync } from "fs";
import { join } from "path";
import { __dirname, createError, log, sha1, strComp } from "./util.js";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { cwd } from "process";
import Commit, { Files } from "./Commit.js";


export default class Repository {
    static WORKING_PATH = join(cwd(), process.env.DEBUG ? 'test_proj' : '');
    static GITLET_PATH = join(this.WORKING_PATH, '.gitlet');
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
        const headCommit = await Commit.read(this.COMMITS_PATH, headHash);
        return new Repository(head, headHash, headCommit);
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
        
        log(`Initialized empty Gitlet repository in ${this.GITLET_PATH}.`)
    }

    async add(filename: string) {
        const filePath = join(Repository.WORKING_PATH, filename);
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
            parent1: this.headHash
        });
        const serial = newCommit.serialize();
        const hash = sha1(serial);

        await writeFile(join(Repository.COMMITS_PATH, hash), serial);
        await writeFile(join(Repository.BRANCHES_PATH, this.head), hash);

        this.headHash = hash;
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
            const filepath = join(Repository.WORKING_PATH, filename);
            if (existsSync(filepath))
                await rm(filepath);
        }
    }

    async log(hash?: string) {
        hash ??= this.headHash;
        const commit = await Commit.read(Repository.COMMITS_PATH, hash);
        log(
`===
commit ${hash}
Date: ${commit.timestamp.toString()}
${commit.message}
`
        );

        if (commit.parent1)
            this.log(commit.parent1);
    }

    async globalLog() {
        for (const hash of await readdir(Repository.COMMITS_PATH)) {
            const commit = await Commit.read(Repository.COMMITS_PATH, hash);
            log(
`===
commit ${hash}
Date: ${commit.timestamp.toString()}
${commit.message}
`
            );
        }
    }

    async find(message: string) {
        let commitFound = false;

        for (const hash of await readdir(Repository.COMMITS_PATH)) {
            const commit = await Commit.read(Repository.COMMITS_PATH, hash);
            if (commit.message === message) {
                log(hash);
                commitFound = true;
            }
        }

        if (!commitFound)
            log('Found no commit with that message.');
    }

    getWorkingFiles = async (): Promise<Files> => readdir(Repository.WORKING_PATH, {
        withFileTypes: true 
    })
    .then(filenames => 
        filenames.filter(filename => filename.isFile())
            .map(filename => 
                readFile(join(Repository.WORKING_PATH, filename.name))
                    .then(buf => [filename.name, sha1(buf)])
            )
    )
    .then(arr => Promise.all(arr))
    .then(Object.fromEntries);

    async status() {
        const branches = await readdir(Repository.BRANCHES_PATH)
            .then(filenames => filenames.sort(strComp));
        branches[branches.indexOf(this.head)] = `*${this.head}`;

        const { staged, removed } = await readdir(Repository.STAGING_PATH)
            .then(filenames => 
                filenames.reduce((obj: { staged: string[], removed: string[] }, filename) => {
                    if (filename.includes('[REMOVE]')) {
                        obj.removed.push(filename.slice(9));
                    } else {
                        obj.staged.push(filename);
                    }

                    return obj;
                }, { staged: [], removed: [] })
            );

        const workingFiles = await this.getWorkingFiles();

        const { modified, unstageRemoved, untracked } = Object.keys(this.headCommit.files).reduce(
            (obj: { modified: string[], unstageRemoved: string[], untracked: string[] }, filename) => {
                if (staged.includes(filename) || removed.includes(filename))
                    return obj;

                if (this.headCommit.files[filename] !== workingFiles[filename]) {
                    obj.modified.push(filename);
                } else if (!workingFiles) {
                    obj.unstageRemoved.push(filename);
                } else {
                    obj.untracked.push(filename);
                }
                
                return obj;
            }, { modified: [], unstageRemoved: [], untracked: [] }
        );

        log(
`=== Branches ===
${branches.join('\n')}

=== Staged Files ===
${staged.sort(strComp).join('\n')}

=== Removed Files ===
${removed.sort(strComp).join('\n')}

=== Modifications Not Staged For Commit ===
${modified.sort(strComp).join('\n')}

=== Untracked Files ===
${untracked.sort(strComp).join('\n')}
`
        );
    }
}