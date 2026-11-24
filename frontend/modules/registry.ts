import { BibliotekarshaModule } from '../core/types';
import { collectionFilterModule } from './collection-filter';
import { gameLocBadgeModule } from './game-loc-badge';
import { gamePageSlotModule } from './game-page-slot';
import { libraryFilterModule } from './library-filter';
import { sidebarCollectionsModule } from './sidebar-collections';

export const ALL_MODULES: BibliotekarshaModule[] = [
  collectionFilterModule,
  libraryFilterModule,
  sidebarCollectionsModule,
  gamePageSlotModule,
  gameLocBadgeModule,
];
