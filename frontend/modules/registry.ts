import { BibliotekarshaModule } from '../core/types';
import { collectionFilterModule } from './collection-filter';
import { gameLocBadgeModule } from './game-loc-badge';
import { gameNfoButtonModule } from './game-nfo-button';
import { gamePageSlotModule } from './game-page-slot';
import { libraryFilterModule } from './library-filter';
import { nfoZogModule } from './nfo-zog';
import { sidebarCollectionsModule } from './sidebar-collections';

export const ALL_MODULES: BibliotekarshaModule[] = [
  collectionFilterModule,
  libraryFilterModule,
  sidebarCollectionsModule,
  gamePageSlotModule,
  gameNfoButtonModule,
  gameLocBadgeModule,
  nfoZogModule,
];
