// const express = require('express');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const cors = require('cors');

// dotenv.config();

// const app = express();
// app.use(express.json({ limit: '50mb' }));
// app.use(cors());

// // Enable Mongoose debug mode to log all database operations
// mongoose.set('debug', true);

// // Connect to MongoDB Atlas with retry logic
// async function connectToMongoDB() {
//   let attempts = 5;
//   while (attempts > 0) {
//     try {
//       await mongoose.connect(process.env.MONGODB_URI, {
//          dbName: 'fastproformabackups',
//       });
//       console.log('Connected to MongoDB Atlas');
//       console.log('Connected to database:', mongoose.connection.name); // Log the database name
//       return;
//     } catch (err) {
//       console.error(`Failed to connect to MongoDB Atlas (attempt ${6 - attempts}):`, err);
//       attempts--;
//       if (attempts === 0) throw err;
//       await new Promise(resolve => setTimeout(resolve, 5000));
//     }
//   }
// }

// connectToMongoDB().catch(err => {
//   console.error('MongoDB connection failed after retries:', err);
//   process.exit(1);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('MongoDB disconnected. Attempting to reconnect...');
//   connectToMongoDB();
// });

// mongoose.connection.on('error', (err) => {
//   console.error('MongoDB connection error:', err);
// });

// // Define a schema for backups
// const backupSchema = new mongoose.Schema({
//   timestamp: { type: Date, default: Date.now },
//   data: { type: Object, required: true },
// });

// const Backup = mongoose.model('Backup', backupSchema);

// // Middleware to check MongoDB connection
// const checkMongoConnection = (req, res, next) => {
//   if (mongoose.connection.readyState !== 1) {
//     console.error('MongoDB connection not ready:', mongoose.connection.readyState);
//     return res.status(500).json({ success: false, message: 'Database connection not ready', readyState: mongoose.connection.readyState });
//   }
//   console.log('MongoDB connection is ready:', mongoose.connection.readyState);
//   next();
// };

// // Middleware to verify the secret key (commented out for now)
// // const verifySecretKey = (req, res, next) => {
// //   const secretKey = req.headers['x-secret-key'];
// //   if (!secretKey || secretKey !== process.env.SECRET_KEY) {
// //     console.log('Unauthorized backup request: Invalid secret key');
// //     return res.status(401).json({ success: false, message: 'Unauthorized' });
// //   }
// //   next();
// // };

// // Health check endpoint
// app.get('/health', checkMongoConnection, (req, res) => {
//   res.status(200).json({ success: true, message: 'Server is healthy', mongoConnected: mongoose.connection.readyState === 1 });
// });

// // Endpoint to handle backup requests
// app.post('/backup', checkMongoConnection, async (req, res) => {
//   try {
//     console.log('Received backup data:', JSON.stringify(req.body, null, 2));
//     const { data } = req.body;
//     if (!data) {
//       console.log('Backup request failed: Missing data');
//       return res.status(400).json({ success: false, message: 'Backup data is required' });
//     }

//     // Double-check connection state before saving
//     console.log('MongoDB connection state before save:', mongoose.connection.readyState);
//     if (mongoose.connection.readyState !== 1) {
//       console.log('MongoDB connection lost. Attempting to reconnect...');
//       await connectToMongoDB();
//     }

//     console.log('Saving to database:', mongoose.connection.name, 'collection: backups'); // Log database and collection
//     const backup = new Backup({ data });
//     console.log('Attempting to save backup...');
//     const savedBackup = await backup.save({ w: 1, j: true }); // Ensure write is acknowledged
//     console.log('Backup saved to MongoDB:', savedBackup._id);

//     // Verify the document exists in the database
//     const verifyBackup = await Backup.findById(savedBackup._id).exec();
//     if (!verifyBackup) {
//       console.error('Failed to verify saved backup in database:', savedBackup._id);
//       throw new Error('Backup save succeeded but document not found in database');
//     }
//     console.log('Verified backup in database:', verifyBackup._id);
//     console.log('MongoDB connection state after save:', mongoose.connection.readyState);

//     res.status(200).json({ success: true, message: 'Backup saved successfully', backupId: savedBackup._id, backup: savedBackup });
//   } catch (error) {
//     console.error('Error saving backup:', error);
//     res.status(500).json({ success: false, message: 'Failed to save backup', error: error.message });
//   }
// });

// // Start the server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Backup server running on port ${PORT}`);
// });




const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Connect to MongoDB Atlas with retry logic
async function connectToMongoDB() {
  let attempts = 5;
  while (attempts > 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('Connected to MongoDB Atlas');
      return;
    } catch (err) {
      console.error(`Failed to connect to MongoDB Atlas (attempt ${6 - attempts}):`, err);
      attempts--;
      if (attempts === 0) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

connectToMongoDB().catch(err => {
  console.error('MongoDB connection failed after retries:', err);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectToMongoDB();
});

// Define schemas for proformas and items
const proformaSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  proformaNumber: String,
  customerName: String,
  plateNumber: String,
  vin: String,
  model: String,
  referenceNumber: String,
  deliveryTime: String,
  preparedBy: String,
  dateCreated: String,
  subTotal: Number,
  vat: Number,
  totalAmount: Number,
  lastModified: String,
});

const itemSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  proformaId: Number,
  itemName: String,
  unit: String,
  quantity: Number,
  cost: Number,
  price: Number,
  lastModified: String,
});

const Proforma = mongoose.model('Proforma', proformaSchema);
const Item = mongoose.model('Item', itemSchema);

// Middleware to check MongoDB connection
const checkMongoConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('MongoDB connection not ready:', mongoose.connection.readyState);
    return res.status(500).json({ success: false, message: 'Database connection not ready', readyState: mongoose.connection.readyState });
  }
  console.log('MongoDB connection is ready:', mongoose.connection.readyState);
  next();
};

// Middleware to verify the secret key
const verifySecretKey = (req, res, next) => {
  const secretKey = req.headers['x-secret-key'];
  if (!secretKey || secretKey !== process.env.SECRET_KEY) {
    console.log('Unauthorized backup request: Invalid secret key');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Health check endpoint
app.get('/health', checkMongoConnection, (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy', mongoConnected: mongoose.connection.readyState === 1 });
});

// Endpoint to handle backup requests
app.post('/backup', checkMongoConnection, verifySecretKey, async (req, res) => {
  try {
    console.log('Received backup data:', JSON.stringify(req.body, null, 2));
    const { data } = req.body;
    if (!data || !data.proformas || !data.items) {
      console.log('Backup request failed: Missing data');
      return res.status(400).json({ success: false, message: 'Backup data is required' });
    }

    console.log('MongoDB connection state before save:', mongoose.connection.readyState);
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB connection lost. Attempting to reconnect...');
      await connectToMongoDB();
    }

    // Process proformas (upsert: update if exists, insert if not)
    for (const proforma of data.proformas) {
      await Proforma.updateOne(
        { id: proforma.id },
        { $set: proforma },
        { upsert: true }
      );
      console.log(`Processed proforma with id ${proforma.id}`);
    }

    // Process items (upsert: update if exists, insert if not)
    for (const item of data.items) {
      await Item.updateOne(
        { id: item.id },
        { $set: item },
        { upsert: true }
      );
      console.log(`Processed item with id ${item.id}`);
    }

    console.log('MongoDB connection state after save:', mongoose.connection.readyState);

    res.status(200).json({ success: true, message: 'Backup saved successfully' });
  } catch (error) {
    console.error('Error saving backup:', error);
    res.status(500).json({ success: false, message: 'Failed to save backup', error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backup server running on port ${PORT}`);
});