const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' })); // Allow large payloads for database backups
app.use(cors());
// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((err) => {
  console.error('Failed to connect to MongoDB Atlas:', err);
});

// Define a schema for backups
const backupSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  data: { type: Object, required: true }, // Store the backup data (e.g., proformas and items)
});

const Backup = mongoose.model('Backup', backupSchema);

// Endpoint to handle backup requests
app.post('/backup', async (req, res) => {
  try {
    console.log('Received backup data:', JSON.stringify(req.body, null, 2))
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'Backup data is required' });
    }

    // Save the backup to MongoDB Atlas
    const backup = new Backup({ data });
    await backup.save();

    res.status(200).json({ success: true, message: 'Backup saved successfully' });
  } catch (error) {
    console.error('Error saving backup:', error);
    res.status(500).json({ success: false, message: 'Failed to save backup' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backup server running on port ${PORT}`);
});