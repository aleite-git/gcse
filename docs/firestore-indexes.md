# Firestore Indexes

This app uses Firestore composite indexes for some queries. If a query fails with
"The query requires an index", create the index listed below.

## Account deletion rate limit

Used by `countRecentDeletionRequests` in `src/lib/account-deletion.ts`.

Collection: `accountDeletionRequests`
Fields:
- `userId` (Ascending)
- `type` (Ascending)
- `createdAt` (Ascending)

If you see an index error, Firestore usually prints a direct link to create it.
