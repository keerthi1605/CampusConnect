import mongoose from 'mongoose';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export const getHealth = (_req, res) => {
  res.json({
    status: 'ok',
    service: 'campusconnect-api',
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    uptime: Math.round(process.uptime()),
  });
};
