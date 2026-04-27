# Performance Optimization TODO

## Backend: Cursor-Based Pagination
- [ ] Replace offset/page with cursor in `/discovery`
- [ ] Replace offset/page with cursor in `/discovery-queue`
- [ ] Replace offset/page with cursor in `/trending`
- [ ] Replace offset/page with cursor in `/new-profiles`
- [ ] Replace offset/page with cursor in `/top-picks`
- [ ] Update service layer to support cursor parameter

## Backend: API Response Caching
- [ ] Add Redis caching for discovery endpoints
- [ ] Add cache invalidation on interactions (like/pass/superlike/block)
- [ ] Add cache helper for paginated lists in redis.js

## Backend: Database Query Optimization
- [ ] Add composite indexes in database.js
- [ ] Add GIN index on interests array
- [ ] Rewrite buildDiscoveryQuery to use NOT EXISTS
- [ ] Remove COUNT(*) OVER() from search
- [ ] Push more filtering into SQL

## Frontend: Lazy Loading
- [ ] Add loading="lazy" to DiscoveryCards images
- [ ] Add loading="lazy" to BrowseProfiles images
- [ ] Add decoding="async" to images
- [ ] Add content-visibility CSS

## Frontend: Cursor Pagination Integration
- [ ] Update datingProfileService.js for cursor
- [ ] Update DiscoveryCards.js for infinite loading
- [ ] Update BrowseProfiles.js for infinite scroll

