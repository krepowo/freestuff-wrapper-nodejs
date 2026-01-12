import type { Request, Response, NextFunction } from 'express';
import type { KeyObject } from 'node:crypto';
import { type VerifierOptions } from './verifier';
type ExpressOptions = Partial<Omit<VerifierOptions, 'publicKey'> & {
    debug?: boolean;
}>;
/** Add freestuff webhooks to any existing express app */
export declare function createExpressHandler(pubkey: string | KeyObject, options?: ExpressOptions): (req: Request, res: Response, next: NextFunction) => void;
/** Let us create an express server for you and already register everything you need. */
export declare function createExpressServer(options: VerifierOptions & {
    port?: number;
    route?: string;
    debug?: boolean;
}): Promise<{
    app: import("express-serve-static-core").Express;
    port: number;
}>;
export {};
