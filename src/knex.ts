import Knex from 'knex';
import config from './config.js';

const knex = Knex({
  client: 'pg',
  connection: {
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name
  }
});

export default knex;