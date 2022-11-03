import knex from './knex.js';

export const create = async () => {
  if (!(await knex.schema.hasTable('items'))) {
    await knex.schema.createTable('items', (t) => {
      t.bigIncrements('id');
      t.text('docId').index();
      t.binary('update');
    });
  }
}

export const drop = async () => {
  if (await knex.schema.hasTable('items')) {
    await knex.schema.dropTable('items');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  create().then(() => console.log('table created')).then(() => knex.destroy());
}