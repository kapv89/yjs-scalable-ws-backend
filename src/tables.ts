import knex from './knex.js';

const run = async () => {
  if (!(await knex.schema.hasTable('items'))) {
    await knex.schema.createTable('items', (t) => {
      t.bigIncrements('id');
      t.text('docname').index();
      t.binary('update');
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(() => console.log('table created')).then(() => knex.destroy());
}