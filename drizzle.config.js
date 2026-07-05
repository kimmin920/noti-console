const databaseUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

const config = {
  dialect: 'postgresql',
  schema: './src/db/schema.js',
  out: './drizzle',
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {}),
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
};

export default config;
