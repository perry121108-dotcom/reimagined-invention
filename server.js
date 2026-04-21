require('dotenv').config();
const express = require('express');
const routes  = require('./api/routes');
const app     = express();
app.use(express.json());
app.use('/api', routes);
app.listen(process.env.PORT || 3000, () => console.log('Server running on port ' + (process.env.PORT || 3000)));
