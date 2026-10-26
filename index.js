import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { errorHandler } from './errorHandler/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('SYD Transport Backend Server is running');
});

// Modular Routes
app.use('/api', routes);

// 404 Middleware
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
