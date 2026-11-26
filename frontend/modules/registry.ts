import { nfoReviewsModule } from './nfo-reviews';
import { libraryRouletteModule } from './library-roulette';
import { nfoFriendsModule } from './nfo-friends';
import { nfoHltbModule } from './nfo-hltb';
import { BibliotekarshaModule } from '../core/types';
import { bshSettingsModule } from './bsh-settings';
import { collectionFilterModule } from './collection-filter';
import { gameLocBadgeModule } from './game-loc-badge';
import { gameNfoButtonModule } from './game-nfo-button';
import { gamePageSlotModule } from './game-page-slot';
import { libraryFilterModule } from './library-filter';
import { nfoZogModule } from './nfo-zog';
import { sidebarCollectionsModule } from './sidebar-collections';
import { watcherModule } from './watcher';

export const ALL_MODULES: BibliotekarshaModule[] = [
  bshSettingsModule,
  collectionFilterModule,
  libraryFilterModule,
  libraryRouletteModule,
  sidebarCollectionsModule,
  gamePageSlotModule,
  gameNfoButtonModule,
  gameLocBadgeModule,
  nfoHltbModule,
  nfoZogModule,
  nfoFriendsModule,
  nfoReviewsModule,
  watcherModule,
];
