import { existsSync } from "fs";
import { join } from "path";
import { __dirname, createError, log, sha1, strComp } from "./util.js";
import { appendFile, cp, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
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

    static createFile = async (filename: string) => writeFile(join(this.WORKING_PATH, `${filename}.txt`), filename);
    static modifyFile = async (filename: string) => appendFile(join(this.WORKING_PATH, `${filename}.txt`), filename);
    static removeFile = async (filename: string) => rm(join(this.WORKING_PATH, `${filename}.txt`), { recursive: true });
    static readFile = async (filename: string) => readFile(join(this.WORKING_PATH, `${filename}.txt`), { encoding: 'utf-8' });

    static async open() {
        if (!existsSync(this.GITLET_PATH))
            createError('Not in an initialized Gitlet directory.');

        const head = await readFile(this.HEAD_PATH, { encoding: 'utf-8' });
        const headHash = await readFile(join(this.BRANCHES_PATH, head), { encoding: 'utf-8' });
        const headCommit = await Commit.read(headHash);
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
        
        log(`Initialized empty Gitlet repository in ${this.GITLET_PATH}.`);
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

        if (sha1(file) !== this.headCommit.files[filename])
            return await writeFile(join(Repository.STAGING_PATH, filename), file);

        if (stagedFile)
            await rm(stagedFilePath);
    }

    async commit(message: string, parent2?: string) {
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
            parent1: this.headHash,
            parent2
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
        const commit = await Commit.read(hash);
        log(
`===
commit ${hash}${
    commit.parent1 && commit.parent2 
    ? `\nMerge: ${commit.parent1.slice(0, 7)} ${commit.parent2.slice(0, 7)}` 
    : ''
}
Date: ${commit.timestamp.toString()}
${commit.message}
`
        );

        if (commit.parent1)
            await this.log(commit.parent1);
    }

    async globalLog() {
        for (const hash of await readdir(Repository.COMMITS_PATH)) {
            const commit = await Commit.read(hash);
            log(
`===
commit ${hash}${
    commit.parent1 && commit.parent2 
    ? `\nMerge: ${commit.parent1.slice(0, 7)} ${commit.parent2.slice(0, 7)}` 
    : ''
}
Date: ${commit.timestamp.toString()}
${commit.message}
`
            );
        }
    }

    async find(message: string) {
        let commitFound = false;

        for (const hash of await readdir(Repository.COMMITS_PATH)) {
            const commit = await Commit.read(hash);
            if (commit.message === message) {
                log(hash);
                commitFound = true;
            }
        }

        if (!commitFound)
            log('Found no commit with that message.');
    }

    static getWorkingFiles = async (): Promise<Files> => readdir(this.WORKING_PATH, {
        withFileTypes: true 
    })
    .then(filenames => 
        filenames.filter(filename => filename.isFile())
            .map(filename => 
                readFile(join(this.WORKING_PATH, filename.name))
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

        const workingFiles = await Repository.getWorkingFiles();

        const modified = Object.keys(this.headCommit.files).reduce(
            (modified: string[], filename) => {
                if (staged.includes(filename) || removed.includes(filename))
                    return modified;

                if (!workingFiles[filename]) {
                    modified.push(`${filename} (deleted)`);
                } else if (this.headCommit.files[filename] !== workingFiles[filename]) {
                    modified.push(`${filename} (modified)`);
                }
                
                return modified;
            }, []
        );

        const untracked = Object.keys(workingFiles)
            .filter(filename => !staged.includes(filename) && !this.headCommit.files[filename]);

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

    async getCommit(commitId: string) {
        if (!existsSync(join(Repository.COMMITS_PATH, commitId)))
            createError('No commit with that id exists.');

        const commit = await Commit.read(commitId);

        const workingFiles = await Repository.getWorkingFiles();
        for (const filename in workingFiles) {
            const fileHash = workingFiles[filename];
            const checkoutHash = commit.files[filename];
            if (!this.headCommit.files[filename] && checkoutHash && fileHash !== checkoutHash)
                createError('There is an untracked file in the way; delete it, or add and commit it first.');
        }

        return commit;
    }

    async overwriteWorking(commit: Commit) {
        for (const filename in commit.files) {
            const fileHash = commit.files[filename];
            await cp(join(Repository.OBJECTS_PATH, fileHash), join(Repository.WORKING_PATH, filename));
        }

        for (const filename in this.headCommit.files) {
            if (!commit.files[filename])
                await rm(join(Repository.WORKING_PATH, filename));
        }

        await rm(Repository.STAGING_PATH, { recursive: true });
        await mkdir(Repository.STAGING_PATH, { recursive: true });

        this.headCommit = commit;
    }

    branchExists = (branchName: string) => existsSync(join(Repository.BRANCHES_PATH, branchName));

    async checkout({ filename, commitId, branchName }: {
        filename?: string;
        commitId?: string;
        branchName?: string;
    }) {
        if (branchName) {
            if (!this.branchExists(branchName)) 
                createError('No such branch exists.');
            
            if (this.head === branchName)
                createError('No need to checkout the current branch.');

            const commitHash = await readFile(join(Repository.BRANCHES_PATH, branchName), { encoding: 'utf-8' });
            const commit = await this.getCommit(commitHash);
            await this.overwriteWorking(commit);

            await writeFile(Repository.HEAD_PATH, branchName);
            
            this.head = branchName;
            this.headHash = commitHash;
        } else if (filename) {
            if (commitId && !existsSync(join(Repository.COMMITS_PATH, commitId)))
                createError('No commit with that id exists.');

            const commit = commitId ? await Commit.read(commitId) : this.headCommit;

            if (!commit.files[filename])
                createError('File does not exist in that commit.');

            await cp(join(Repository.OBJECTS_PATH, commit.files[filename]), join(Repository.WORKING_PATH, filename));
        }
    }

    async branch(branchName: string) {
        if (this.branchExists(branchName)) 
            createError('A branch with that name already exists.');

        await writeFile(join(Repository.BRANCHES_PATH, branchName), this.headHash);
    }

    async rmBranch(branchName: string) {
        if (!this.branchExists(branchName)) 
            createError('A branch with that name does not exist.');

        await rm(join(Repository.BRANCHES_PATH, branchName));
    }

    async reset(commitId: string) {
        const commit = await this.getCommit(commitId);
        await this.overwriteWorking(commit);

        await writeFile(join(Repository.BRANCHES_PATH, this.head), commitId);
        this.headHash = commitId;
    }

    async merge(branchName: string) {
        if (await readdir(Repository.STAGING_PATH).then(arr => arr.length))
            createError('You have uncommitted changes.');

        if (!this.branchExists(branchName))
            createError('A branch with that name does not exist.');

        if (this.head === branchName)
            createError('Cannot merge a branch with itself.');
        
        const givenHash = await readFile(join(Repository.BRANCHES_PATH, branchName), { encoding: 'utf-8' });

        const splitPointHash = await Commit.findSplitPoint(this.headHash, givenHash);

        if (!splitPointHash)
            return createError('Cannot merge a branch with itself.');
        
        if (splitPointHash === givenHash)
            return log('Given branch is an ancestor of the current branch.');

        const givenCommit = await this.getCommit(givenHash);

        if (splitPointHash === this.headHash) {
            await this.overwriteWorking(givenCommit);

            await writeFile(join(Repository.BRANCHES_PATH, this.head), givenHash);
            this.headHash = givenHash;
            return log('Current branch fast-forwarded.');
        }

        const splitPoint = await this.getCommit(splitPointHash);
        await this.getCommit(this.headHash);

        const allFilenames = new Set(
            [ 
                splitPoint.files, this.headCommit.files, givenCommit.files 
            ].reduce((arr: string[], files) => arr.concat(Object.keys(files)), [])
        );

        let mergeConflict = false;

        const files: Files = {};

        for (const filename of allFilenames) {
            const splitHash = splitPoint.files[filename];
            const currentHash = this.headCommit.files[filename];
            const givenFileHash = givenCommit.files[filename];
            
            if (splitHash && currentHash && givenFileHash && splitHash !== givenFileHash && splitHash === currentHash) {
                await this.checkout({ filename, commitId: givenHash });
                await this.add(filename);
            } 
            else if (splitHash && currentHash && givenFileHash && splitHash !== currentHash && splitHash === givenFileHash) 
                continue;
            else if (splitHash && splitHash !== currentHash && currentHash === givenFileHash)
                continue;
            else if (!splitHash && currentHash && !givenFileHash) 
                continue;
            else if (!splitHash && !currentHash && givenFileHash) {
                await this.checkout({ filename, commitId: givenHash });
                await this.add(filename);
            }
            else if (splitHash && splitHash === currentHash && !givenFileHash) {
                await rm(join(Repository.WORKING_PATH, filename));
                if (existsSync(join(Repository.STAGING_PATH, filename)))
                    await rm(join(Repository.STAGING_PATH, filename));
            } else if (splitHash && splitHash === givenFileHash && !currentHash) 
                continue;
            else {
                mergeConflict = true;
                await writeFile(
                    join(Repository.WORKING_PATH, filename), 
                    `<<<<<<< HEAD
${currentHash ? await readFile(join(Repository.OBJECTS_PATH, currentHash), { encoding: 'utf-8' }) : ''}
=======
${givenFileHash ? await readFile(join(Repository.OBJECTS_PATH, givenFileHash), { encoding: 'utf-8' }) : ''}
>>>>>>>
`
                );
            }
        }

        await this.commit(`Merged ${branchName} into ${this.head}.`, givenHash);

        if (mergeConflict)
            log('Encountered a merge conflict.');
    }
}