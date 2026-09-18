require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const connectDB = require('./config/db')
const { notFound, errorHandler } = require('./middleware/errorHandler')

const app = express()

const allowedOrigins = ['http://localhost:5173', process.env.CLIENT_URL].filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }))

app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/users', require('./routes/userRoutes'))
app.use('/api/sets', require('./routes/questionSetRoutes'))
app.use('/api/attempts', require('./routes/attemptRoutes'))
app.use('/api/admin', require('./routes/adminRoutes'))

app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
})