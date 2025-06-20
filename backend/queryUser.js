const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  queryUser();
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

async function queryUser() {
  try {
    const user = await User.findOne({ username: 'temp' });
    if (user) {
      console.log('User found:', user);
    } else {
      console.log('User not found');
    }
    mongoose.connection.close();
  } catch (err) {
    console.error('Error querying user:', err);
    mongoose.connection.close();
  }
}