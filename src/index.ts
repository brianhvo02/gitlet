import { mkdir, rm, writeFile } from "fs/promises";
import Repository from "./Repository.js";
import { join } from "path";
import assert from "assert";
import { existsSync } from "fs";

if (existsSync(Repository.WORKING_PATH))
    await rm(Repository.WORKING_PATH, { recursive: true });
await mkdir(Repository.WORKING_PATH, { recursive: true });
await Repository.createFile('test1');
await Repository.createFile('test2');

await Repository.init();
const repo = await Repository.open();

await repo.add('test1.txt');
await repo.add('test2.txt');
await repo.commit('test commit');

await repo.rm('test1.txt');
await repo.commit('remove test1.txt');
const removeHash = repo.headHash;

await Repository.createFile('test1');
await Repository.createFile('test3');
await repo.add('test1.txt');
await repo.add('test3.txt');
await repo.commit('test commit');

await repo.branch('testing');
await repo.checkout({ branchName: 'testing' });

await Repository.modifyFile('test1');
await repo.rm('test2.txt');
await Repository.removeFile('test3');
await Repository.createFile('test4');
await repo.add('test4.txt');
await Repository.createFile('test5');

// await repo.status();

/*
=== Branches ===
main
*testing

=== Staged Files ===
test4.txt

=== Removed Files ===
test2.txt

=== Modifications Not Staged For Commit ===
test1.txt (modified)
test3.txt (deleted)

=== Untracked Files ===
test5.txt

*/

await repo.add('test1.txt');
await repo.commit('testing branch commit');
const testingHash = repo.headHash;
assert(await Repository.readFile('test1') === 'test1test1');
assert(await Repository.readFile('test4') === 'test4');
assert(await Repository.readFile('test5') === 'test5');

await repo.checkout({ filename: 'test3.txt' });
await repo.checkout({ branchName: 'main' });
assert(await Repository.readFile('test1') === 'test1');
assert(await Repository.readFile('test2') === 'test2');
assert(await Repository.readFile('test3') === 'test3');
assert(await Repository.readFile('test5') === 'test5');

await repo.checkout({ commitId: testingHash, filename: 'test1.txt' });
assert(await Repository.readFile('test1') === 'test1test1');

await repo.rmBranch('testing');

await repo.reset(removeHash);
assert(await Repository.readFile('test2') === 'test2');
assert(await Repository.readFile('test5') === 'test5');

await repo.branch('fast-forward');
await repo.checkout({ branchName: 'fast-forward' });

await repo.add('test5.txt');
await repo.commit('add test5');

await repo.merge('main');

await repo.checkout({ branchName: 'main' });
await repo.merge('fast-forward');

await Repository.createFile('test1');
await repo.add('test1.txt');
await Repository.createFile('test3.1');
await repo.add('test3.1.txt');
await Repository.createFile('test3.2');
await repo.add('test3.2.txt');
await repo.rm('test5.txt');
await Repository.createFile('test6');
await repo.add('test6.txt');
await Repository.createFile('test7');
await repo.add('test7.txt');
await Repository.createFile('test8.1');
await repo.add('test8.1.txt');
await Repository.createFile('test8.2');
await repo.add('test8.2.txt');
await Repository.createFile('test8.3');
await repo.add('test8.3.txt');
await repo.commit('merge-test-0');

await repo.branch('merge-test-1')
await repo.checkout({ branchName: 'merge-test-1' });
await Repository.modifyFile('test2');
await repo.add('test2.txt');
await Repository.modifyFile('test3.1');
await repo.add('test3.1.txt');
await repo.rm('test3.2.txt');
await Repository.createFile('test4');
await repo.add('test4.txt');
await repo.rm('test7.txt');
await Repository.modifyFile('test8.1');
await repo.add('test8.1.txt');
await Repository.modifyFile('test8.2');
await repo.add('test8.2.txt');
await repo.rm('test8.3.txt');
await Repository.createFile('test8.4');
await repo.add('test8.4.txt');
await repo.commit('merge test commit 1');

await repo.checkout({ branchName: 'main' });
await repo.branch('merge-test-2');
await repo.checkout({ branchName: 'merge-test-2' });
await Repository.modifyFile('test1');
await repo.add('test1.txt');
await Repository.modifyFile('test3.1');
await repo.add('test3.1.txt');
await repo.rm('test3.2.txt');
await Repository.createFile('test5');
await repo.add('test5.txt');
await repo.rm('test6.txt');
await Repository.modifyFile('test8.1');
await Repository.modifyFile('test8.1');
await repo.add('test8.1.txt');
await repo.rm('test8.2.txt');
await Repository.modifyFile('test8.3');
await repo.add('test8.3.txt');
await Repository.createFile('test8.4');
await Repository.modifyFile('test8.4');
await repo.add('test8.4.txt');
await repo.commit('merge test commit 2');

await repo.checkout({ branchName: 'merge-test-1' });
await repo.merge('merge-test-2');

// console.log('=== LOG ===');
// await repo.log();

// console.log('=== GLOBAL LOG ===');
// await repo.globalLog();