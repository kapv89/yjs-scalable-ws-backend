# About
Example of crdt websocket backend for [y-js](https://github.com/yjs/yjs) to be used with [y-websocket](https://github.com/yjs/y-websocket) provider with persitence to an api server. Uses redis-pubsub for horizontal scaling and uses redis-queues to provide eventual-consistency and better behaviour when users join a document being edited by other users. Also provides logic of read-only/read+write access to documents.

# Usage
1. `npm ci` - the `postinstall` script `fix_y-websocket.js` fixes the dev-dependency `y-websocket`, so step#5 is no longer needed
2. `npm run build`
3. `cp .env.example .env.test.local`
4. Fill in `.env.test.local`
5. [NOT NEEDED ANYMORE] go to `node_modules/y-websocket/package.json`, and add `"type": "module"` after line#2, `"name": "y-websocket"`. This is necessary to make the unit tests run
6. `docker-compose up` to start redis
7. `npm run test`
8. Go through `src/__tests__/app.test.ts` to view details for tests