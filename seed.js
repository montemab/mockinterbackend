require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('./config/db')
const User = require('./models/user')

const run = async () => {
  await connectDB()

  const name = process.env.SEED_ADMIN_NAME || 'Platform Admin'
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@mockinter.com'
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123'

  const existing = await User.findOne({ email })

  if (existing) {
    console.log('Admin already exists:', email)
  } else {
    await User.create({
      name,
      email,
      password,
      role: 'admin',
      status: 'approved',
    })
    console.log('✅ Admin created')
    console.log('   Email:    ', email)
    console.log('   Password: ', password)
  }

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})