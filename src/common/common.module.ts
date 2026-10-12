import { Global, Module } from '@nestjs/common';
import { CatalogGuardsService } from './services/catalog-guards.service';

/**
 * Cross-cutting providers used across feature modules.
 * `@Global()` — no need to import in every feature module.
 */
@Global()
@Module({
    providers: [CatalogGuardsService],
    exports: [CatalogGuardsService],
})
export class CommonModule { }