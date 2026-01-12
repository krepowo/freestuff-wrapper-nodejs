export declare class Problem extends Error {
    readonly raw: Record<string, unknown>;
    readonly type: string;
    readonly title: string;
    readonly detail: string;
    constructor(raw: Record<string, unknown>);
}
