export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'SYD Transport Backend Server is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};
