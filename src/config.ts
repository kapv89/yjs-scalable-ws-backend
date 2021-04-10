const config = {
  testing: process.env.JEST_WORKER_ID !== undefined,

  server: {
    port: Number(process.env.SERVER_PORT),
    host: process.env.SERVER_HOST as string
  }
}

export default config;