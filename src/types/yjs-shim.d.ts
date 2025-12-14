/* YJS 协作库类型声明 - 可选依赖 */

// 如果需要使用协作功能，请安装以下依赖：
// npm install yjs y-protocols lib0

declare module 'yjs' {
  export class Doc {
    constructor();
    clientID: number;
    getMap(name: string): any;
    getText(name: string): any;
    getArray(name: string): any;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
  }
  export class Transaction {}
  export class Array {}
  export class Map {}
  export class Text {}
}

declare module 'y-protocols/sync' {
  export function writeSyncStep1(encoder: any, doc: any): void;
  export function writeUpdate(encoder: any, update: Uint8Array): void;
  export function readSyncMessage(decoder: any, encoder: any, doc: any, transactionOrigin: any): any;
}

declare module 'y-protocols/awareness' {
  export class Awareness {
    constructor(doc: any);
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
    setLocalState(state: any): void;
    getLocalState(): any;
    getStates(): Map<number, any>;
    meta: Map<number, any>;
  }
  export function writeAwarenessUpdate(encoder: any, awareness: Awareness, clients?: number[]): void;
  export function applyAwarenessUpdate(awareness: Awareness, update: Uint8Array, origin: any): void;
}

declare module 'lib0/observable' {
  export class Observable<T = string> {
    on(name: T, f: Function): void;
    off(name: T, f: Function): void;
    emit(name: T, args: any[]): void;
  }
}

declare module 'lib0/encoding' {
  export function createEncoder(): any;
  export function writeVarUint(encoder: any, num: number): void;
  export function writeVarUint8Array(encoder: any, data: Uint8Array): void;
  export function toUint8Array(encoder: any): Uint8Array;
  export function length(encoder: any): number;
}

declare module 'lib0/decoding' {
  export function createDecoder(data: Uint8Array): any;
  export function readVarUint(decoder: any): number;
  export function readVarUint8Array(decoder: any): Uint8Array;
}
