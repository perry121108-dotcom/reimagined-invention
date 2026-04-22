require('dotenv').config();
const express = require('express');
const routes  = require('./api/routes');
const app     = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api', routes);
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
