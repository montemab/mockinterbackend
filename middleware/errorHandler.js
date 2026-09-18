const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` })
}

const errorHandler = (err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(422).json({ message: `Invalid ${err.path}` })
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    return res.status(409).json({ message: `${field} already in use` })
  }

  console.error(err.stack)
  const status = res.statusCode >= 400 ? res.statusCode : 500
  res.status(status).json({
    message: err.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

module.exports = { notFound, errorHandler }