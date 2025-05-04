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


// Health check endpoint
app.get('/health', checkMongoConnection, (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy', mongoConnected: mongoose.connection.readyState === 1 });
});

// Endpoint to handle backup requests
app.post('/backup', checkMongoConnection, async (req, res) => {
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

// app.get('/proformas', checkMongoConnection, async (req, res) => {
//   try {
//     const { proformaNumber } = req.query; // Optional query parameter to filter by proformaNumber
//     let query = {};
//     if (proformaNumber) {
//       query.proformaNumber = proformaNumber;
//     }

//     // Fetch all proformas matching the query
//     const proformas = await Proforma.find(query).exec();
//     if (!proformas || proformas.length === 0) {
//       return res.status(404).json({ success: false, message: 'No proformas found' });
//     }

//     // Fetch items for each proforma
//     const proformaData = [];
//     for (const proforma of proformas) {
//       const items = await Item.find({ proformaId: proforma.id }).exec();
//       const formattedItems = items.map(item => ({
//         itemName: item.itemName,
//         unit: item.unit,
//         quantity: item.quantity,
//         unitPrice: item.unitPrice,
//       }));

//       proformaData.push({
//         proformaNumber: proforma.proformaNumber,
//         customerName: proforma.customerName,
//         plateNumber: proforma.plateNumber,
//         vin: proforma.vin,
//         model: proforma.model,
//         referenceNumber: proforma.referenceNumber,
//         deliveryTime: proforma.deliveryTime,
//         preparedBy: proforma.preparedBy,
//         items: formattedItems,
//       });
//     }

//     res.status(200).json({ success: true, proformas: proformaData });
//   } catch (error) {
//     console.error('Error retrieving proformas:', error);
//     res.status(500).json({ success: false, message: 'Failed to retrieve proformas', error: error.message });
//   }
// });






app.get('/proformas', checkMongoConnection, async (req, res) => {
  try {
    // 1. Fetch ALL proformas sorted by date (newest first)
    const proformas = await Proforma.find({})
      .sort({ dateCreated: -1, lastModified: -1 })
      .exec();

    // 2. Fetch items for each (optimized with single query)
    const items = await Item.find({
      proformaId: { $in: proformas.map(p => p.id) }
    }).exec();

    // 3. Format response
    const response = proformas.map(p => ({
      proformaNumber: p.proformaNumber,
      customerName: p.customerName,
      plateNumber: p.plateNumber,
      vin: p.vin,
      model: p.model,
      referenceNumber: p.referenceNumber,
      deliveryTime: p.deliveryTime,
      preparedBy: p.preparedBy,
      items: items.filter(i => i.proformaId === p.id).map(i => ({
        itemName: i.itemName,
        unit: i.unit,
        quantity: i.quantity
      }))
    }));

    res.status(200).json({ 
      success: true,
      proformas: response,
      count: response.length,
      latestModified: proformas[0]?.lastModified // For debugging
    });
  } catch (error) {
    console.error('Full proforma fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
 // Add this to your server code for debugging
app.get('/debug-proformas', async (req, res) => {
  const dbCount = await Proforma.countDocuments();
  const apiCount = (await Proforma.find().lean()).length;
  
  res.json({
    dbCount,
    apiCount,
    discrepancy: dbCount - apiCount,
    sampleRecord: await Proforma.findOne().lean()
  });
});
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backup server running on port ${PORT}`);
});
