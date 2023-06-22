#!/usr/bin/env node
import Repository from "./Repository.js";
import { argv } from "process";
const [_, __, command, arg1, arg2, arg3] = argv;
if (command === 'init') {
    Repository.init();
    process.exit(0);
}
const repo = await Repository.open();
switch (command) {
    case 'add':
        repo.add(arg1);
        break;
    case 'commit':
        repo.commit(arg1);
        break;
    case 'rm':
        repo.rm(arg1);
        break;
    case 'log':
        repo.log();
        break;
    case 'global-log':
        repo.globalLog();
        break;
    case 'find':
        repo.find(arg1);
        break;
    case 'status':
        repo.status();
        break;
    case 'checkout':
        if (arg1 === '--')
            repo.checkout({ filename: arg2 });
        else if (arg2 === '--')
            repo.checkout({ commitId: arg1, filename: arg3 });
        else
            repo.checkout({ branchName: arg1 });
        break;
    case 'branch':
        repo.branch(arg1);
        break;
    case 'rm-branch':
        repo.rmBranch(arg1);
        break;
    case 'reset':
        repo.reset(arg1);
        break;
    case 'merge':
        repo.merge(arg1);
        break;
}
