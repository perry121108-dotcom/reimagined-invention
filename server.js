require('dotenv').config();
const express   = require('express');
const rateLimit = require('express-rate-limit');
const routes    = require('./api/routes');
const app       = express();

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
});
app.use(limiter);

app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ message: "後端連線成功！", status: "OK" });
});

app.use('/api', routes);
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
