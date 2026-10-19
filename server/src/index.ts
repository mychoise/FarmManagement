import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Global Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', routes);

// Error Handling Middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Green Pasture API Server running on port ${PORT}`);
    console.log(` Database: AbhishekFarm (PostgreSQL)`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
}

export default app;
