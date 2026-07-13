module.exports = {
  apps: [
    {
      name: "taiguo-mes",
      script: "npm",
      args: "start -- -p 3004 -H 127.0.0.1",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_BASE_PATH: "/taiguo-mes",
      },
    },
  ],
};
