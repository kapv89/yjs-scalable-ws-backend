const config = {
  testing: process.env.JEST_WORKER_ID !== undefined,

  server: {
    port: Number(process.env.SERVER_PORT),
    host: process.env.SERVER_HOST as string
  },

  db: {
    host: process.env.DB_HOST as string,
    user: process.env.DB_USER as string,
    name: process.env.DB_NAME as string,
    password: process.env.DB_PASSWORD as string
  }
}

export default config;