import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Prioritize .env.local from project root or server dir
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
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
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
    const branch = process.env.NEON_BRANCH || (isNeon ? 'Neon (Cloud)' : 'Local');
    console.log(`===============================================`);
    console.log(` Green Pasture API Server running on port ${PORT}`);
    console.log(` Database: ${isNeon ? `Neon Postgres [Branch: ${branch}]` : 'Local PostgreSQL'}`);
    console.log(` Health check: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
}

export default app;
