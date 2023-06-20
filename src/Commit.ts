import { readFile } from "fs/promises";
import { join } from "path";

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
        this.timestamp = ['string', 'number'].includes(typeof serial.timestamp) ? new Date(serial.timestamp) : new Date();
        this.message = serial.message;
        this.files = serial.files;
        this.parent1 = serial.parent1;
        this.parent2 = serial.parent2;
    }

    static read = async (path: string, hash: string) => 
        readFile(join(path, hash), { encoding: 'utf-8' })
            .then(JSON.parse)
            .then(raw => new Commit(raw));

    serialize = () => JSON.stringify({
        timestamp: this.timestamp.getTime(),
        message: this.message,
        files: this.files,
        parent1: this.parent1,
        parent2: this.parent2
    });
}