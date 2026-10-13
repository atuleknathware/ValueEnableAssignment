const app = require('./app');
const config = require('./config');
const db = require('./config/database');

async function startServer() {
  try {
    // Initialize database connection
    db.initDatabase();
    console.log(`Database initialized (Mode: ${db.isMemoryDb() ? 'pg-mem emulator' : db.getDbType() + ' pool'})`);

    const server = app.listen(config.port, () => {
      console.log(`Benefit Illustration API server running on port ${config.port} in ${config.nodeEnv} mode`);
    });

    const shutdown = () => {
      console.log('Gracefully shutting down...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;

