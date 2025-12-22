// Load environment variables from .env.local when running the local dev API server.
// This lets you put SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into .env.local
// and have the API process pick them up when started via `npm run dev:api`.

import express from 'express';
import bodyParser from 'body-parser';

// Wrap everything in an async IIFE to avoid top-level await issues with ts-node-dev
(async () => {
  // Load dotenv if available, but don't crash if it's not installed yet.
  try {
    const dotenv = await import('dotenv');
    // Load .env.local first (takes precedence), then fall back to .env
    dotenv.config({ path: '.env.local' });
    dotenv.config(); // Load .env as fallback
    console.log('✅ Environment variables loaded from .env.local');
  } catch (err) {
    // dotenv is convenient for local dev but may not be installed in every environment.
    // If it's missing, warn and continue; the user can run `npm install --save-dev dotenv`.
    // eslint-disable-next-line no-console
    console.warn('⚠️  dotenv not installed; skipping .env.local load. Run `npm install --save-dev dotenv` to enable.');
  }

  // Import the consolidated API handlers from src/server_handlers
  // All handlers are now in the server_handlers directory
  // These are CommonJS modules, so we need to handle them specially
  const uploadHandlerModule: any = await import('../src/server_handlers/upload_csv_real.js');
  const jobsHandlerModule: any = await import('../src/server_handlers/jobs.js');
  const metricsHandlerModule: any = await import('../src/server_handlers/metrics.js');
  const inventoryHandlerModule: any = await import('../src/server_handlers/inventory.js');
  const quickMessagesHandlerModule: any = await import('../src/server_handlers/quick_messages.js');

  // For CommonJS modules, the function is in .default when imported as ES module
  const uploadHandler: any = typeof uploadHandlerModule.default === 'function' ? uploadHandlerModule.default : uploadHandlerModule;
  const jobsHandler: any = typeof jobsHandlerModule.default === 'function' ? jobsHandlerModule.default : jobsHandlerModule;
  const metricsHandler: any = typeof metricsHandlerModule.default === 'function' ? metricsHandlerModule.default : metricsHandlerModule;
  const inventoryHandler: any = typeof inventoryHandlerModule.default === 'function' ? inventoryHandlerModule.default : inventoryHandlerModule;
  const quickMessagesHandler: any = typeof quickMessagesHandlerModule.default === 'function' ? quickMessagesHandlerModule.default : quickMessagesHandlerModule;

  // Note: mapping_presets and profiles handlers may need to be added to server_handlers
  // For now, we'll try to load them from the old locations if they exist
  let mappingHandler: any;
  let profilesHandler: any;
  let healthHandler: any;

  try {
    const _mapping = await import('../api_disabled/mapping_presets.js');
    mappingHandler = _mapping && (_mapping.default || _mapping);
  } catch (err) {
    console.warn('mapping_presets handler not found, endpoint will not be available');
    mappingHandler = (req: any, res: any) => res.status(501).json({ error: 'Not implemented' });
  }

  try {
    const _profiles = await import('../src/Pages/api_profiles.js');
    profilesHandler = _profiles && (_profiles.default || _profiles);
  } catch (err) {
    console.warn('profiles handler not found, endpoint will not be available');
    profilesHandler = (req: any, res: any) => res.status(501).json({ error: 'Not implemented' });
  }

  try {
    const _health = await import('../api_disabled/supabase-health.js');
    healthHandler = _health && (_health.default || _health);
  } catch (err) {
    console.warn('health handler not found, endpoint will not be available');
    healthHandler = (req: any, res: any) => res.status(200).json({ ok: true, message: 'Health check endpoint not configured' });
  }

  // Import ImageKit handlers
  let imagekitAuthHandler: any;
  let imagekitUploadHandler: any;
  let imagekitDeleteHandler: any;
  let imagekitMetadataHandler: any;

  try {
    const imagekitModule: any = await import('../src/server_handlers/imagekit.js');
    imagekitAuthHandler = imagekitModule.handleImageKitAuth;
    imagekitUploadHandler = imagekitModule.handleImageKitUpload;
    imagekitDeleteHandler = imagekitModule.handleImageKitDelete;
    imagekitMetadataHandler = imagekitModule.handleSaveImageMetadata;
  } catch (err) {
    console.warn('ImageKit handlers not found, endpoints will not be available');
    const notImplemented = (req: any, res: any) => res.status(501).json({ error: 'ImageKit not configured' });
    imagekitAuthHandler = notImplemented;
    imagekitUploadHandler = notImplemented;
    imagekitDeleteHandler = notImplemented;
    imagekitMetadataHandler = notImplemented;
  }

  const app = express();

  // Add CORS middleware for development
  app.use((req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  app.use(bodyParser.json({ limit: '50mb' }));

  app.post('/api/upload-csv', (req: any, res: any) => {
    return uploadHandler(req, res);
  });

  // Root handler to make it obvious the dev API server is running
  app.get('/', (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      message: 'Dev API server running. Available routes: /api/upload-csv (POST), /api/jobs (GET/POST/PATCH), /api/metrics (GET), /api/inventory (GET/POST), /api/quick_messages (GET/POST)'
    });
  });

  app.all('/api/mapping_presets', (req: any, res: any) => {
    return mappingHandler(req, res);
  });

  app.all('/api/jobs', (req: any, res: any) => {
    return jobsHandler(req, res);
  });

  // Inventory endpoints (GET)
  app.all('/api/inventory', (req: any, res: any) => {
    return inventoryHandler(req, res);
  });

  // Profiles endpoint (GET, POST/PUT)
  app.all('/api/profiles', (req: any, res: any) => {
    return profilesHandler(req, res);
  });

  // Quick messages (GET)
  app.all('/api/quick_messages', (req: any, res: any) => {
    return quickMessagesHandler(req, res);
  });

  // Metrics (GET)
  app.get('/api/metrics', (req: any, res: any) => {
    return metricsHandler(req, res);
  });

  app.get('/api/supabase-health', (req: any, res: any) => {
    return healthHandler(req, res);
  });

  // ImageKit endpoints
  app.get('/api/imagekit-auth', (req: any, res: any) => {
    return imagekitAuthHandler(req, res);
  });

  app.post('/api/imagekit-upload', (req: any, res: any) => {
    return imagekitUploadHandler(req, res);
  });

  app.delete('/api/imagekit-delete', (req: any, res: any) => {
    return imagekitDeleteHandler(req, res);
  });

  app.post('/api/imagekit-save-metadata', (req: any, res: any) => {
    return imagekitMetadataHandler(req, res);
  });

  const port = Number(process.env.DEV_API_PORT || 3001);
  const server = app.listen(port, () => {
    console.log(`\n✅ Dev API server listening on http://localhost:${port}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   POST /api/upload-csv`);
    console.log(`   GET  /api/jobs`);
    console.log(`   POST /api/jobs`);
    console.log(`   PATCH /api/jobs`);
    console.log(`   GET  /api/metrics`);
    console.log(`   GET  /api/inventory`);
    console.log(`   POST /api/inventory`);
    console.log(`   GET  /api/quick_messages`);
    console.log(`   POST /api/quick_messages`);
    console.log(`   GET  /api/imagekit-auth`);
    console.log(`   POST /api/imagekit-upload`);
    console.log(`   DELETE /api/imagekit-delete`);
    console.log(`   POST /api/imagekit-save-metadata`);
    console.log(`\n⚠️  Note: Environment variables loaded from .env.local`);
    console.log(`   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set\n`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${port} is already in use.`);
      console.error(`   Try: export DEV_API_PORT=3002 && npm run dev:api`);
      console.error(`   Or kill the process: lsof -ti:${port} | xargs kill\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
})();
