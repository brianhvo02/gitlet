import { mkdir, rm, writeFile } from "fs/promises";
import Repository from "./Repository.js";
import { join } from "path";
import assert from "assert";

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

await repo.status();

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

console.log('=== LOG ===');
await repo.log();

console.log('=== GLOBAL LOG ===');
await repo.globalLog();

await repo.rmBranch('testing');

await repo.reset(removeHash);
assert(await Repository.readFile('test2') === 'test2');
assert(await Repository.readFile('test5') === 'test5');