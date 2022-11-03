const config = {
  testing: process.env.JEST_WORKER_ID !== undefined,

  server: {
    port: Number(process.env.SERVER_PORT),
    host: process.env.SERVER_HOST as string
  },

  redis: {
    host: process.env.REDIS_HOST as string,
    port: Number(process.env.REDIS_PORT as string),
    keyPrefix: process.env.REDIS_PREFIX as string,
    ...((() => {
      const password = process.env.REDIS_PASSWORD as (string | undefined)
      
      if (password && password.length > 0) {
        return {password}
      }

      return {}
    })())
  },

  api: {
    base: process.env.API_ENDPOINT_BASE as string
  }
}

export default config;