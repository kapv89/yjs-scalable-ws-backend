# Demo
https://www.loom.com/share/f152340723af40e7bacd3f67fafb2d69?sid=2bab7fa4-4de0-4bc8-a6ce-05166b96af4d

# About
Example of crdt websocket backend for [y-js](https://github.com/yjs/yjs) to be used with [y-websocket](https://github.com/yjs/y-websocket) provider with persitence to an api server. Uses redis-pubsub for horizontal scaling and uses redis-queues to provide eventual-consistency and better behaviour when users join a document being edited by other users. Also provides logic of read-only/read+write access to documents.

# Usage
1. `git clone git@github.com:kapv89/yjs-scalable-ws-backend.git`
1. `cd yjs-scalable-ws-backend`
1. `npm ci` - the `postinstall` script `fix_y-websocket.js` fixes the dev-dependency `y-websocket`
1. `npm run build`
1. `cp .env.example .env.test.local`
1. Update `.env.test.local` as per your system.
1. `docker-compose up` to start redis
1. `npm run watch` in a terminal tab
1. `npm run test`
1. Go through `src/__tests__/app.test.ts` to view details for tests

# USE WITH [`k_yrs_go`](https://github.com/kapv89/k_yrs_go)