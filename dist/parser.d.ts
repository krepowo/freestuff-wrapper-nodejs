import type { FsbEvent } from './types';
export declare function parseEpochTimestamp(timestamp: unknown): Date | null;
export declare function parseEvent(event: Record<string, unknown>): FsbEvent;
