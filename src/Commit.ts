import { readFile } from "fs/promises";
import { join } from "path";
import Repository from "./Repository.js";

export interface Files {
    [filename: string]: string;
}

interface SerializedCommit {
    timestamp: number | string | Date;
    message: string;
    files: Files;
    parent1?: string;
    parent2?: string;
}

export default class Commit implements SerializedCommit {
    timestamp: Date;
    message: string;
    files: Files;
    parent1?: string | undefined;
    parent2?: string | undefined;

    constructor(serial: SerializedCommit) {
        this.timestamp = typeof serial.timestamp === 'string' || typeof serial.timestamp === 'number' ? new Date(serial.timestamp) : serial.timestamp;
        this.message = serial.message;
        this.files = serial.files;
        this.parent1 = serial.parent1;
        this.parent2 = serial.parent2;
    }

    static read = async (hash: string) => 
        readFile(join(Repository.COMMITS_PATH, hash), { encoding: 'utf-8' })
            .then(JSON.parse)
            .then(raw => new Commit(raw));

    serialize = () => JSON.stringify({
        timestamp: this.timestamp.getTime(),
        message: this.message,
        files: this.files,
        parent1: this.parent1,
        parent2: this.parent2
    });

    static async findSplitPoint(currentHash: string, givenHash: string): Promise<string | null> {
        // console.log(currentHash, givenHash)
        if (currentHash === givenHash)
            return currentHash;
        
        const currentCommit = await Commit.read(currentHash);
        const givenCommit = await Commit.read(givenHash);

        if (!currentCommit.parent1 || !givenCommit.parent1) 
            return null;

        if (currentCommit.timestamp > givenCommit.timestamp) {
            return this.findSplitPoint(currentCommit.parent1, givenHash);
        } else {
            return this.findSplitPoint(currentHash, givenCommit.parent1);
        }
    }
}