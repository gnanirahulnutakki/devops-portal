const config = {
    development: {
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            user: process.env.POSTGRES_USER || 'backstage',
            password: process.env.POSTGRES_PASSWORD || 'backstage',
            database: process.env.POSTGRES_DB || 'backstage',
        },
        migrations: {
            directory: './migrations',
            extension: 'ts',
            tableName: 'knex_migrations_gitops',
        },
        seeds: {
            directory: './seeds',
            extension: 'ts',
        },
    },
    production: {
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            database: process.env.POSTGRES_DB,
        },
        migrations: {
            directory: './migrations',
            extension: 'ts',
            tableName: 'knex_migrations_gitops',
        },
        pool: {
            min: 2,
            max: 10,
        },
    },
};
export default config;
//# sourceMappingURL=knexfile.js.map