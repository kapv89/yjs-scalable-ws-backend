# Code from this repo live on [erdtool.com](https://erdtool.com)!!!

# NEW!!
Horizontally scaled websocket backend that can talk to any external api for persistence and provide read-only and read+write access levels:
### Branch [external_api_persistence](https://github.com/kapv89/yjs-scalable-ws-backend/tree/external_api_persistence)

---

### `main`-branch

# About
Example of horizontally scalable websocket backend for [y-js](https://github.com/yjs/yjs) to be used with [y-websocket](https://github.com/yjs/y-websocket) provider with persitence to postgresql using [knex](http://knexjs.org/). Uses redis-pubsub for horizontal scaling and uses redis-queues to provide eventual-consistency and better behaviour when users join a document being edited by other users.

# Usage
1. `npm ci`
2. `npm run build`
3. `cp .env.example .env.local`
4. Fill in `.env.local`
5. `npm run tables` -> creates the tables for doc persistence in db
5. `npm run dev` -> starts the websocket-server
6. On the client-side, initialize a yjs doc and use the y-websocket provider to connect to the websocket-server

# How it works
This repo is a slightly reworked websocket server found in the y-websocket repo([link](https://github.com/yjs/y-websocket/blob/master/bin/server.js)).

The websocket-server that comes with y-websocket essentially maintains a copy of the y-js document(s) in memory and syncs it between different clients connected to the same doc.

The websocket-server in this repo isolates the updates that clients send to it, persists these updates to the database, and publishes these updates (using redis-pubsub) in a channel for the document. Also, when a doc is created for the first time in the websocket-server, the server reads all the updates stored in the database, and applies those updates to the document, effectively initializing it.

This makes the websocket-server provided in this repo persistent and horizontally-scalable on paper.

~~The code in this repo hasn't been tested in a production system yet, and from the looks of it, will be a long time before I would be able to run it on a production system, but theoretically, the code in this repo should be sufficient and can be tweaked to suit any project.~~

**The code from this repo is live on (https://erdtool.com)**

# Companion testing repo
[repo](https://github.com/kapv89/yjs-scalable-ws-backend-test)

# Deploy to Kubernetes

For local testing, we first have to spin up minikube and create some namespaces

```
minikube start
kubectl create ns backend
kubectl create ns postgresql
kubectl create ns redis
```

Then we have to install PostgreSQL and Redis

```
helm install psql bitnami/postgresql --version 11.9.11 --namespace postgresql --set global.postgresql.servicePort=5432 --set global.postgresql.postgresqlDatabase=yjs_db \
    --set global.postgresql.postgresqlUsername=test_user --set global.postgresql.postgresqlPassword=mypass

helm install redis bitnami/redis --version 17.3.7 --namespace redis --set auth.enabled=false
```

After building the Docker image

```
eval $(minikube docker-env)
docker build -f ./Dockerfile -t kapv89/yjs-backend-ws:test .
```

we can deploy the service with our helm charts

```
helm install yjs-backend-ws ./chart/yjs-backend-ws --namespace backend \
 --set image.tag=test \
 --set secret.db_host="psql-postgresql.postgresql.svc.cluster.local:5432" \
 --set secret.db_user="test_user" \
 --set secret.db_password="mypass" \
 --set secret.db_name="yjs_db" \
 --set secret.redis_host="redis-master.redis.svc.cluster.local" \
 --set secret.redis_port="6379" \
 --set secret.redis_prefix="backend.crdtwss."
 ```