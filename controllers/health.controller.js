export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Hughes Transport Backend Server is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};
