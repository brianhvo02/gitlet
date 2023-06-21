import { mkdir, rmdir, writeFile } from "fs/promises";
import Repository from "./Repository.js";
import { join } from "path";

await rmdir(Repository.WORKING_PATH, { recursive: true });
await mkdir(Repository.WORKING_PATH, { recursive: true });
await writeFile(join(Repository.WORKING_PATH, 'test1.txt'), 'test1');
await writeFile(join(Repository.WORKING_PATH, 'test2.txt'), 'test2');

await Repository.init();
const repo = await Repository.open();

await repo.add('test1.txt');
await repo.add('test2.txt');
await repo.commit('test commit');

await repo.rm('test1.txt');
await repo.commit('remove test1.txt');

await writeFile(join(Repository.WORKING_PATH, 'test1.txt'), 'test1');
await repo.add('test1.txt');
await repo.commit('test commit');

// await repo.log();
// await repo.globalLog();
// await repo.find('test commit');

await writeFile(join(Repository.WORKING_PATH, 'test1.txt'), 'test1.1');
await repo.rm('test2.txt');
await writeFile(join(Repository.WORKING_PATH, 'test3.txt'), 'test3');
await repo.add('test3.txt');
await writeFile(join(Repository.WORKING_PATH, 'test4.txt'), 'test4');

await repo.status();