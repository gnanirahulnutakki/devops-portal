import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { DatabaseService } from '@backstage/backend-plugin-api';
import express from 'express';
export interface RouterOptions {
    logger: LoggerService;
    config: RootConfigService;
    database: DatabaseService;
}
export declare function createRouter(options: RouterOptions): Promise<express.Router>;
//# sourceMappingURL=router%202.d.ts.map