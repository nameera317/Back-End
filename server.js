const express = require("express"); //Create an Express application
const app = express();
const axios = require("axios");
const router = express.Router(); // Create an Express Router
const mongoose = require("mongoose"); // For our Database connection
const cors = require("cors");
import dotenv from 'dotenv';
dotenv.config();
const PORT = process.env.PORT || 3000; // Setting up the PORT

app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);

// Mount the router at a specific API path
app.use("/api", router);

// Connect to your MongoDB database
mongoose
  .connect(
    "mongodb+srv://nameera317:nameera123@cluster0.dbcniga.mongodb.net/",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "backendItems",
    }
  )
  .then(() => console.log("Database connected..."))
  .catch((e) => console.log(e));

// Define a Mongoose model and insert data
const itemSchema = new mongoose.Schema({
  id: Number,
  title: String,
  price: Number,
  description: String,
  category: String,
  image: String,
  sold: Boolean,
  dateOfSale: Date,
});

const Item = mongoose.model("Item", itemSchema);

async function fetchThirdPartyData() {
  const url = "https://s3.amazonaws.com/roxiler.com/product_transaction.json";
  const response = await axios.get(url);
  return response.data;
}

// API route to initialize the database
router.get("/initialize-database", async (req, res) => {
  try {
    // Fetch JSON data from the third-party API
    const thirdPartyData = await fetchThirdPartyData();

    console.log(thirdPartyData);
    // Insert seed data from third-party API
    await Item.insertMany(thirdPartyData);

    // Disconnect from MongoDB
    await mongoose.disconnect();

    res.status(200).send({ message: "Database initialized" });
  } catch (error) {
    console.error("Error initializing database:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/search", async (req, res) => {
  const items = await Item.find();
  res.status(200).send(items);
});

router.get("/statistics/:month", async (req, res) => {
  const monthName = req.params.month.toLowerCase();
  const transactions = await Item.find();
  const monthNumber = getMonthNumber(monthName);

  if (monthNumber === null) {
    return res.status(400).json({ error: "Invalid month name" });
  }

  let totalPrice = 0;
  let totalItemSold = 0;
  let totalItemNotSold = 0;

  transactions.forEach((transaction) => {
    const objectOfDateOfSale = new Date(transaction.dateOfSale);
    const monthFromDataOfSale = objectOfDateOfSale.getMonth() + 1;

    if (monthFromDataOfSale === monthNumber) {
      totalPrice += transaction.price;
      if (transaction.sold == true) {
        totalItemSold += 1;
      } else {
        totalItemNotSold += 1;
      }
    }
  });

  res.status(200).send({ totalPrice, totalItemSold, totalItemNotSold });
});

router.get("/pie-chart/:month", async (req, res) => {
  const monthName = req.params.month.toLowerCase();
  const transactions = await Item.find();
  const monthNumber = getMonthNumber(monthName);

  if (monthNumber === -1)
    return res.status(400).send({ error: "Invalid month name" });

  // Initialize an object to store item counts for each category
  const itemCountsByCategory = {};

  let filteredTransactions = transactions.filter((transaction) => {
    const objectOfDateOfSale = new Date(transaction.dateOfSale);
    const monthFromDataOfSale = objectOfDateOfSale.getMonth() + 1;
    if (monthFromDataOfSale === monthNumber) {
      return transaction;
    }
    return null;
  });

  const uniqueCategories = [
    ...new Set(filteredTransactions.map((transaction) => transaction.category)),
  ];

  // Count the number of items in each unique category and create the response object
  const ItemCountsByCategory = uniqueCategories.map((category) => ({
    category: category,
    value: filteredTransactions.filter(
      (transaction) => transaction.category === category
    ).length,
  }));

  res.status(200).send({ ItemCountsByCategory });
});

router.get("/combined-data/:month", async (req, res) => {
  const monthName = req.params.month.toLowerCase();
  const response1 = await axios.get(
    `http://localhost:3000/api/statistics/${monthName}`
  );
  const res1 = response1.data;
  const response2 = await axios.get(
    `http://localhost:3000/api/pie-chart/${monthName}`
  );
  const res2 = response2.data;
  const response3 = await axios.get(
    `http://localhost:3000/api/bar-chart/${monthName}`
  );
  const res3 = response3.data;

  // Combine the responses into a single JSON object
  const combinedData = {
    dataFromAPI1: res1,
    dataFromAPI2: res2,
    dataFromAPI3: res3,
  };
  // Send the combined JSON response to the client
  res.json(combinedData);
});

router.get("/bar-chart/:month", async (req, res) => {
  const monthName = req.params.month.toLowerCase();
  const transactions = await Item.find();
  const monthNumber = getMonthNumber(monthName);

  if (monthNumber === -1) {
    return res.status(400).json({ error: "Invalid month name" });
  }

  // Define price ranges with category labels
  const priceRanges = [
    { category: "0-100", min: 0, max: 100 },
    { category: "101-200", min: 101, max: 200 },
    { category: "201-300", min: 201, max: 300 },
    { category: "301-400", min: 301, max: 400 },
    { category: "401-500", min: 401, max: 500 },
    { category: "501-600", min: 501, max: 600 },
    { category: "601-700", min: 601, max: 700 },
    { category: "701-800", min: 701, max: 800 },
    { category: "801-900", min: 801, max: 900 },
    { category: "901-above", min: 901, max: Infinity },
  ];

  // Initialize an object to store item counts by category
  const itemCounts = {};

  // Initialize counts to 0 for all categories
  for (const range of priceRanges) {
    itemCounts[range.category] = 0;
  }

  transactions.forEach((transaction) => {
    const objectOfDateOfSale = new Date(transaction.dateOfSale);
    const monthFromDataOfSale = objectOfDateOfSale.getMonth() + 1;

    if (monthFromDataOfSale === monthNumber) {
      const price = transaction.price;
      for (const range of priceRanges) {
        if (price >= range.min && price <= range.max) {
          // Increment the count for the corresponding category
          itemCounts[range.category]++;
          break; // Exit the loop once a category is matched
        }
      }
    }
  });

  // Transform itemCounts into the desired format
  const itemCountsArray = Object.keys(itemCounts).map((category) => ({
    category,
    value: itemCounts[category],
  }));

  res.status(200).json({ itemCounts: itemCountsArray });
});

// API route to list the transactions
router.get("/list-transactions/:month", async (req, res) => {
  const monthName = req.params.month.toLowerCase();
  const transactions = await Item.find();
  const monthNumber = getMonthNumber(monthName);

  if (monthNumber === -1)
    return res.status(400).send({ error: "Invalid month name" });

  let filteredTransactions = transactions.filter((transaction) => {
    const objectOfDateOfSale = new Date(transaction.dateOfSale);
    const monthFromDataOfSale = objectOfDateOfSale.getMonth() + 1;
    if (monthFromDataOfSale === monthNumber) {
      return transaction;
    }
    return null;
  });

  res.status(200).send(filteredTransactions);
});

// Helper function to convert month name to month number
function getMonthNumber(monthName) {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const monthIndex = monthNames.indexOf(monthName);
  return monthIndex !== -1 ? monthIndex + 1 : -1; // Return month number or -1 for invalid month
}

// Start the Express server
app.listen(PORT, () => {
  console.log(`server is running on ${PORT}`);
});

// mongodb+srv://nameera317:<password>@cluster0.dbcniga.mongodb.net/
// nameera123
