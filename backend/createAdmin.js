const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "123456",
    role: "admin",
    isEmailVerified: true
  });

  console.log("Admin created:", admin.email);
  process.exit();
});