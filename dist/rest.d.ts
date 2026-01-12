import { FsbStaticApiV2EventList, FsbStaticApiV2ProblemList, FsbStaticApiV2Schema, FsbStaticApiV2SchemaList } from './types';
type Options = {
    baseUrl?: string;
};
export declare class RestApiClient {
    private client;
    constructor(token: string, options?: Options);
    getPing(): Promise<any>;
    readonly static: {
        getSchemas: () => Promise<FsbStaticApiV2SchemaList>;
        getSchema: (urn: string) => Promise<FsbStaticApiV2Schema>;
        getProblems: () => Promise<FsbStaticApiV2ProblemList>;
        getEvents: () => Promise<FsbStaticApiV2EventList>;
    };
}
export {};
