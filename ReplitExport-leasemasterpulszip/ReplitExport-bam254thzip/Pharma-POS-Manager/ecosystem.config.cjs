const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.MYSQL_URL ??
  "mysql://pharmaos:pharmaos@127.0.0.1:3307/pharmaos";

module.exports = {
  apps: [
    {
      name: "pharmaos",
      cwd: __dirname,
      script: "node",
      args: "--enable-source-maps ./artifacts/api-server/dist/index.mjs",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT ?? "5000",
        DATABASE_URL: databaseUrl,
        SERVE_WEB: "true",
        WEB_DIST_DIR: process.env.WEB_DIST_DIR ?? "artifacts/pharma-pos/dist/public",
        JWT_SECRET: process.env.JWT_SECRET ?? "pharmaos-local-jwt-secret",
        MPESA_ENCRYPTION_KEY: process.env.MPESA_ENCRYPTION_KEY ?? "pharmaos-local-mpesa-encryption-key",
        PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? "http://localhost:5000",
      },
    },
  ],
};
